-- Solicitudes de presupuesto que llegan por WhatsApp.
--
-- Lo pidió Cestería en su guía del bot (01/10/2026): «toda petición de precio
-- que entre por WhatsApp tiene que acabar en info@, para que entre en el
-- seguimiento de presupuestos. Ahora mismo las que entran por WhatsApp no quedan
-- registradas en ningún sitio». El bot ya recogía los datos en la conversación,
-- pero se quedaban ahí, mezclados con el resto del chat.
--
-- Dos piezas:
--   1. A qué correo mandarlas: una preferencia más del cliente, junto a la de los
--      avisos (0010), porque puede ser otro buzón que el de los avisos — los
--      avisos van a quien atiende el WhatsApp; los presupuestos, a quien los hace.
--   2. Una tabla con cada solicitud. Sirve de registro, y además es lo que evita
--      mandar dos veces el mismo correo (ver `huella`).

alter table client_notification_settings
  add column if not exists email_presupuestos text;

create table if not exists presupuestos_whatsapp (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,

  -- El número de WhatsApp de quien lo pide. Es lo único que seguro tenemos:
  -- el resto lo ha dado la persona en la conversación.
  telefono text not null,
  nombre text,
  tipo_cliente text,
  producto text,
  medidas_unidades text,
  email text,
  direccion text,

  -- El modelo rellena el presupuesto en el mensaje en que completa los datos,
  -- pero nada le impide volver a rellenarlo en el siguiente («¡gracias!»), con
  -- los mismos datos todavía a la vista en el historial. Sin esto, cada
  -- respuesta de cortesía mandaría otro correo a info@.
  --
  -- La huella son los datos que importan, en minúsculas. Si la persona corrige
  -- algo («perdona, son 4 unidades»), la huella cambia y sale un correo nuevo,
  -- que es lo que tiene que pasar: el presupuesto ya no es el mismo.
  huella text generated always as (
    md5(lower(
      telefono || '|' ||
      coalesce(producto, '') || '|' ||
      coalesce(medidas_unidades, '') || '|' ||
      coalesce(email, '') || '|' ||
      coalesce(direccion, '')
    ))
  ) stored,

  -- A dónde se mandó, si se mandó. Vacío cuando el cliente no tiene configurado
  -- correo de presupuestos: la solicitud queda registrada igual.
  enviado_a text,

  created_at timestamptz not null default now(),

  unique (client_id, huella)
);

create index if not exists presupuestos_whatsapp_cliente_idx
  on presupuestos_whatsapp (client_id, created_at desc);

alter table presupuestos_whatsapp enable row level security;

create policy "agency access to whatsapp quotes"
  on presupuestos_whatsapp for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- El cliente las lee; las escribe n8n con service_role (ver 0008).
create policy "client users read own whatsapp quotes"
  on presupuestos_whatsapp for select
  using (es_usuario_del_cliente(client_id));
