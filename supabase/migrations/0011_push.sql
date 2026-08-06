-- Suscripciones de notificaciones push, una por dispositivo.
--
-- No es lo mismo que la preferencia «quiero avisos en el móvil», que vive en
-- `client_notification_settings`: eso es una decisión del negocio, y esto es el
-- permiso concreto que ha dado *un* teléfono. La misma persona puede tener el
-- móvil y la tablet, y dos personas del mismo negocio, un móvil cada una.
--
-- El endpoint lo emite el navegador y es lo que identifica al dispositivo: es
-- una URL del servicio de push (Google, Mozilla, Apple) que solo sirve para
-- ese navegador y esa instalación. Si se desinstala la app o se limpian datos,
-- deja de valer y el servicio responde 410, momento en el que hay que borrarla.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,

  -- Quién dio el permiso. Sirve para que al quitarle el acceso a una persona se
  -- lleve por delante sus notificaciones.
  user_id uuid references auth.users(id) on delete cascade,

  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  -- Para que en el panel se lea «Chrome en Android» y no una URL de 200
  -- caracteres. Solo informativo.
  user_agent text,

  created_at timestamptz not null default now(),
  last_ok_at timestamptz,

  -- Cuántos envíos seguidos han fallado sin llegar a ser un 410. Un dispositivo
  -- que acumula fallos es candidato a limpiarse.
  fallos integer not null default 0
);

create index if not exists push_subscriptions_cliente_idx
  on push_subscriptions (client_id);

alter table push_subscriptions enable row level security;

create policy "agency access to push subscriptions"
  on push_subscriptions for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- El cliente ve sus dispositivos para poder quitarlos; darse de alta y de baja
-- pasa por server action, como todo lo que escribe desde el panel.
create policy "client users read own push subscriptions"
  on push_subscriptions for select
  using (es_usuario_del_cliente(client_id));
