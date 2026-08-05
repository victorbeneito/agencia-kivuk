-- Lo que le falta a `conversations` para ser una bandeja de verdad.
--
-- Hasta ahora la tabla era un contenedor de mensajes: id, cliente, canal,
-- contacto y fecha de creación. Suficiente para un visor de solo lectura,
-- insuficiente en cuanto una persona tiene que poder meterse en un chat y
-- responder ella.

-- === Estado de la conversación ===
alter table conversations
  -- Quién lleva la conversación. Mientras esté en 'human', el workflow de n8n
  -- guarda el mensaje entrante y no responde.
  add column if not exists mode text not null default 'bot'
    check (mode in ('bot', 'human')),

  -- Vuelta automática al bot. Sin esto, cualquiera que abra un chat y se
  -- despiste deja al cliente final sin respuesta indefinidamente: el bot está
  -- callado y no hay nadie escribiendo. El workflow compara con `now()`.
  add column if not exists human_until timestamptz,

  -- Cuándo pidió el contacto hablar con una persona. Lo marca el propio bot
  -- (acción `escalar`), para que la bandeja lo destaque en vez de obligar a
  -- leer todos los hilos buscando quién está esperando.
  add column if not exists handoff_requested_at timestamptz,

  -- Ordenar la bandeja por `created_at` daba el orden equivocado: con el upsert
  -- de la 0002 esa fecha es la del *primer* contacto, así que un hilo abierto
  -- hace un mes con un mensaje de hace un minuto salía el último.
  add column if not exists last_message_at timestamptz,

  -- Último mensaje *del contacto*, que es desde donde Meta cuenta las 24 horas
  -- en las que se puede responder con texto libre. Fuera de esa ventana solo
  -- se pueden enviar plantillas aprobadas, y la interfaz tiene que saberlo
  -- antes de dejar escribir.
  add column if not exists last_inbound_at timestamptz,

  add column if not exists unread_count integer not null default 0,

  -- Un trozo del último mensaje, para la lista de la bandeja. Es un dato
  -- duplicado a propósito: sacarlo de `messages` obliga a un «último mensaje de
  -- cada conversación», que en PostgREST no se pide en una sola consulta y
  -- acaba siendo una llamada por hilo. Lo mantiene el mismo trigger que el
  -- resto, así que no se puede quedar desfasado.
  add column if not exists last_message_preview text,

  -- El número de teléfono pelado no dice nada. Si en algún momento se sabe el
  -- nombre (Meta lo manda en el webhook), se guarda aquí.
  add column if not exists contact_name text,

  -- Quién está atendiendo. Informativo: no bloquea a nadie, pero evita que dos
  -- personas contesten a la vez sin enterarse.
  add column if not exists assigned_to uuid references auth.users(id);

create index if not exists conversations_bandeja_idx
  on conversations (client_id, last_message_at desc);

-- === Quién escribió cada mensaje ===
-- `role` no sirve para distinguirlo: un mensaje escrito por una persona del
-- negocio es 'assistant' desde el punto de vista del modelo (es un turno de su
-- lado de la conversación, y así el bot lo entiende cuando retoma el hilo),
-- pero en la bandeja tiene que verse distinto y saberse quién lo mandó.
alter table messages
  add column if not exists sender text
    check (sender in ('contact', 'bot', 'human')),
  add column if not exists sent_by_user_id uuid references auth.users(id);

-- Los mensajes que ya existen: se deduce del rol, que hasta hoy solo lo
-- escribía el bot.
update messages
   set sender = case when role = 'user' then 'contact' else 'bot' end
 where sender is null;

-- Que n8n no tenga que acordarse de mandarlo. El workflow lo manda explícito
-- para los mensajes de una persona, pero si algún día se ejecuta una versión
-- antigua del flujo, el mensaje entra bien clasificado igualmente.
create or replace function mensajes_completar_sender()
returns trigger
language plpgsql
as $$
begin
  if new.sender is null then
    new.sender := case when new.role = 'user' then 'contact' else 'bot' end;
  end if;
  return new;
end;
$$;

drop trigger if exists mensajes_completar_sender_trg on messages;
create trigger mensajes_completar_sender_trg
  before insert on messages
  for each row execute function mensajes_completar_sender();

alter table messages alter column sender set not null;

-- === Mantener el estado de la conversación al vuelo ===
-- Se hace en la base y no en n8n a propósito: los mensajes los inserta el
-- workflow, pero también las server actions del panel, y mañana quizá otro
-- canal. Con un trigger, ninguno puede olvidarse.
create or replace function conversaciones_al_llegar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
         last_message_preview = left(new.content, 140),
         last_inbound_at = case
           when new.sender = 'contact'
             then greatest(coalesce(last_inbound_at, new.created_at), new.created_at)
           else last_inbound_at
         end,
         -- Solo cuenta como no leído lo que llega de fuera. Lo que responde el
         -- bot o una persona del negocio ya lo ha visto quien lo mandó.
         unread_count = case
           when new.sender = 'contact' then unread_count + 1
           else unread_count
         end
   where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists conversaciones_al_llegar_mensaje_trg on messages;
create trigger conversaciones_al_llegar_mensaje_trg
  after insert on messages
  for each row execute function conversaciones_al_llegar_mensaje();

-- Rellenar el estado de lo que ya hay, para que la bandeja no salga vacía de
-- fechas el primer día. Los no leídos se dejan a cero: dar por leído el
-- histórico es más honesto que estrenar la bandeja con un contador enorme.
update conversations c
   set last_message_at = coalesce(m.ultimo, c.created_at),
       last_inbound_at = m.ultimo_entrante,
       last_message_preview = left(m.texto_ultimo, 140)
  from (
    select distinct on (conversation_id)
           conversation_id,
           max(created_at) over (partition by conversation_id) as ultimo,
           max(created_at) filter (where role = 'user')
             over (partition by conversation_id) as ultimo_entrante,
           content as texto_ultimo
      from messages
     order by conversation_id, created_at desc
  ) m
 where m.conversation_id = c.id;

update conversations
   set last_message_at = created_at
 where last_message_at is null;

-- === Realtime ===
-- El chat se actualiza solo escuchando estas dos tablas. Realtime respeta la
-- RLS del usuario conectado, así que cada uno recibe únicamente lo suyo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table conversations;
  end if;
end $$;
