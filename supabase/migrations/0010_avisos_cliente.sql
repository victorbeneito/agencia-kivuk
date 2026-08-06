-- Cómo quiere cada cliente que le avisemos de que alguien espera respuesta.
--
-- Tabla propia y no un campo más en `client_modules.config` por lo mismo que
-- `social_accounts` en la 0005: ese jsonb guarda credenciales y el cliente no
-- puede verlo (0008). Esto en cambio es una preferencia SUYA — cómo quiere que
-- le molestemos y en qué correo — así que tiene que poder leerla y cambiarla.
--
-- Es además el primer sitio donde poner los ajustes que en el futuro edite el
-- cliente (horario de atención, tono de marca), que hoy siguen encerrados junto
-- a los tokens.

create table if not exists client_notification_settings (
  client_id uuid primary key references clients(id) on delete cascade,

  -- Aviso dentro del panel: un sonido y el contador en el título de la
  -- pestaña. Activado por defecto porque no molesta a nadie que no tenga el
  -- panel abierto, y quien lo tiene abierto es justo a quien sirve.
  en_panel boolean not null default true,

  -- Aviso por correo cuando alguien pide hablar con una persona. Desactivado
  -- por defecto: mandar correos que nadie ha pedido es la forma más rápida de
  -- que el cliente se acostumbre a ignorarlos.
  por_email boolean not null default false,

  -- A dónde. Puede no ser el email con el que entra al panel: quien atiende el
  -- WhatsApp no siempre es quien administra la cuenta.
  email text,

  -- Preparado para la PWA. Todavía no lo usa nadie: las suscripciones push
  -- necesitan su propia tabla (una por dispositivo) y eso llega con la app.
  push boolean not null default false,

  updated_at timestamptz not null default now()
);

alter table client_notification_settings enable row level security;

create policy "agency access to notification settings"
  on client_notification_settings for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- El cliente lee sus preferencias; escribirlas pasa por una server action, como
-- todo lo demás que toca desde el panel (ver 0008).
create policy "client users read own notification settings"
  on client_notification_settings for select
  using (es_usuario_del_cliente(client_id));

-- Fila por defecto para los clientes que ya existen, para que el panel no tenga
-- que distinguir entre «no configurado» y «configurado a lo de siempre».
insert into client_notification_settings (client_id)
select c.id from clients c
on conflict (client_id) do nothing;

-- Y para los que vengan. En la base y no en el alta del panel porque los
-- clientes también se crean por SQL y desde n8n: si depende de que alguien se
-- acuerde, tarde o temprano hay un cliente sin fila y un aviso que no sale.
create or replace function crear_avisos_del_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into client_notification_settings (client_id)
  values (new.id)
  on conflict (client_id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_avisos_del_cliente_trg on clients;
create trigger crear_avisos_del_cliente_trg
  after insert on clients
  for each row execute function crear_avisos_del_cliente();
