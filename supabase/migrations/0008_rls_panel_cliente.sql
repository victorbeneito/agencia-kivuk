-- Cerrar la RLS antes de que exista el primer usuario de cliente.
--
-- Hasta ahora todas las políticas seguían el mismo patrón: "si perteneces a la
-- agencia dueña del cliente O eres el propio cliente, acceso total". Era
-- suficiente mientras el único que entraba al panel era la agencia. Deja de
-- serlo el día que se crea un `client_user`, porque `client_modules.config`
-- guarda el `access_token` de WhatsApp, el `google_client_secret`, el
-- `refresh_token` de Calendar, la clave de Resend y el token de Instagram: con
-- una llamada al API público de Supabase desde el navegador, el cliente los
-- tendría todos. Da igual lo que enseñe la interfaz — RLS es la única frontera.
--
-- Criterio que se aplica aquí:
--   · La agencia sigue con acceso total a todo (no cambia nada para el panel
--     que ya existe).
--   · El cliente ve, y solo ve: su ficha, qué módulos tiene activos (sin el
--     `config`), sus conversaciones y mensajes, y sus piezas de contenido.
--   · El cliente no escribe nada directamente. Las acciones que sí puede hacer
--     (aprobar una pieza, tomar el mando de un chat, marcar como leído) pasan
--     por server actions con `service_role` que comprueban permisos y validan
--     la transición. Así el conjunto de escrituras posibles es una lista corta
--     y revisable, en vez de "cualquier UPDATE que se le ocurra al navegador".
--   · Prompt, base de conocimiento y catálogo son trabajo de la agencia: el
--     cliente no los ve. Un prompt tocado sin criterio rompe el bot.

-- === Helpers ===
-- Las mismas dos preguntas se repetían en cada política con un subselect a
-- mano. Como funciones se leen mejor y, sobre todo, se corrigen en un sitio.
-- `security definer` para que la comprobación no dependa a su vez de la RLS de
-- `user_profiles`, y `search_path` fijado porque en una función security
-- definer un search_path heredado es una vía de escalada.

create or replace function es_agencia_del_cliente(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clients c
    join user_profiles up on up.agency_id = c.agency_id
    where c.id = p_client_id
      and up.id = auth.uid()
  );
$$;

create or replace function es_usuario_del_cliente(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_profiles up
    where up.id = auth.uid()
      and up.client_id = p_client_id
  );
$$;

revoke execute on function es_agencia_del_cliente(uuid) from public;
revoke execute on function es_usuario_del_cliente(uuid) from public;
grant execute on function es_agencia_del_cliente(uuid) to authenticated;
grant execute on function es_usuario_del_cliente(uuid) to authenticated;

-- === clients ===
-- El `client_user` no podía leer ni el nombre de su propio negocio.

create policy "client users see own client"
  on clients for select
  using (es_usuario_del_cliente(id));

-- === client_modules ===
-- Aquí viven las credenciales: acceso solo para la agencia.

drop policy if exists "agency or client access to modules" on client_modules;

create policy "agency access to modules"
  on client_modules for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- Lo único que el cliente necesita saber de sus módulos es cuáles tiene
-- activos, para que el panel dibuje su navegación. La vista lo expone sin el
-- `config`, y filtra por `auth.uid()` dentro de sí misma: es una vista
-- security definer (el comportamiento por defecto), así que salta la RLS de la
-- tabla de debajo y el filtro de aquí es el que manda. Sin ese `where` sería
-- un agujero, con él es exactamente lo contrario.
create or replace view client_modules_publicos as
  select cm.client_id, cm.module, cm.active
  from client_modules cm
  where es_agencia_del_cliente(cm.client_id)
     or es_usuario_del_cliente(cm.client_id);

revoke all on client_modules_publicos from anon;
grant select on client_modules_publicos to authenticated;

-- === agent_configs, conocimiento y catálogo: solo agencia ===

drop policy if exists "agency or client access to agent configs" on agent_configs;

create policy "agency access to agent configs"
  on agent_configs for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "agency or client access to knowledge documents" on knowledge_documents;

create policy "agency access to knowledge documents"
  on knowledge_documents for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "agency or client access to knowledge chunks" on knowledge_chunks;

create policy "agency access to knowledge chunks"
  on knowledge_chunks for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "agency or client access to catalog" on catalog_products;

create policy "agency access to catalog"
  on catalog_products for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- === conversations y messages ===
-- El cliente lee su bandeja. Escribir (tomar el mando, marcar leído, enviar un
-- mensaje) pasa por server action; enviar, además, por n8n, que es quien tiene
-- el token de Meta.

drop policy if exists "agency or client access to conversations" on conversations;

create policy "agency access to conversations"
  on conversations for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

create policy "client users read own conversations"
  on conversations for select
  using (es_usuario_del_cliente(client_id));

drop policy if exists "agency or client access to messages" on messages;

create policy "agency access to messages"
  on messages for all
  using (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and es_agencia_del_cliente(conv.client_id)
    )
  )
  with check (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and es_agencia_del_cliente(conv.client_id)
    )
  );

create policy "client users read own messages"
  on messages for select
  using (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and es_usuario_del_cliente(conv.client_id)
    )
  );

-- === content_items ===
-- El cliente ve sus piezas y las aprueba desde el panel, pero la aprobación no
-- es un UPDATE suelto: dispara una publicación real. Va por server action, que
-- comprueba desde qué estado se sale y a cuál se llega.

drop policy if exists "agency or client access to content" on content_items;

create policy "agency access to content"
  on content_items for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

create policy "client users read own content"
  on content_items for select
  using (es_usuario_del_cliente(client_id));
