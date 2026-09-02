-- Facturación: qué cobra la agencia, a quién y por qué concepto.
--
-- Hasta ahora la plataforma sabía todo del trabajo que hace para el cliente y
-- nada del dinero. Esto cierra ese hueco: datos fiscales de las dos partes,
-- catálogo de servicios con su precio, qué tiene contratado cada cliente, y las
-- facturas que salen de ahí.
--
-- Tres decisiones que condicionan todo lo demás:
--
--   1. **El borrador no lleva número.** En España la numeración tiene que ser
--      correlativa y sin huecos. Si se numerase al crear, cada borrador que se
--      descarta dejaría un agujero que hay que justificar. El número se asigna
--      al emitir, y desde ese momento la factura ya no se edita.
--   2. **La factura emitida guarda una copia de los datos fiscales** de emisor
--      y receptor (`emisor`/`receptor`). Si el cliente se muda, sus facturas
--      viejas tienen que seguir enseñando la dirección que tenían el día que se
--      emitieron: son documentos, no vistas de la ficha actual.
--   3. **Un tipo de IVA e IRPF por factura**, no por línea. Una agencia factura
--      servicios, todos al mismo tipo; permitir tipos mezclados complicaría la
--      pantalla y el PDF a cambio de un caso que aquí no se da.

-- === Helper: ¿esta agencia es la mía? ===
-- El equivalente a `es_agencia_del_cliente` (0008) para las tablas que cuelgan
-- de la agencia y no de un cliente concreto.

create or replace function es_mi_agencia(p_agency_id uuid)
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
      and up.agency_id = p_agency_id
      and up.role = 'agency_admin'
  );
$$;

revoke execute on function es_mi_agencia(uuid) from public;
grant execute on function es_mi_agencia(uuid) to authenticated;

-- === Datos fiscales y de facturación de la agencia ===

create table if not exists agency_billing_settings (
  agency_id uuid primary key references agencies(id) on delete cascade,

  razon_social text not null default '',
  nif text not null default '',
  direccion text not null default '',
  codigo_postal text not null default '',
  ciudad text not null default '',
  provincia text not null default '',
  pais text not null default 'España',
  email text not null default '',
  telefono text not null default '',
  web text not null default '',

  -- Dónde cobra. El IBAN sale impreso en la factura, así que no es un secreto
  -- que haya que esconder como una API key.
  iban text not null default '',

  -- Numeración. `serie` + ejercicio + contador → "F2026-0001". El contador se
  -- reinicia solo al cambiar de año (lo hace `siguiente_numero_factura`).
  serie text not null default 'F',
  ejercicio int not null default extract(year from current_date)::int,
  siguiente_numero int not null default 1,

  -- Valores por defecto de una factura nueva. El IRPF empieza en 0 porque solo
  -- lo retienen los autónomos que facturan a empresas; una S.L. no retiene.
  iva_por_defecto numeric(5,2) not null default 21,
  irpf_por_defecto numeric(5,2) not null default 0,
  dias_vencimiento int not null default 15,

  -- Texto al pie: condiciones, recargo por demora, aviso de protección de datos.
  pie_factura text not null default '',

  updated_at timestamptz not null default now()
);

alter table agency_billing_settings enable row level security;

create policy "agency manages own billing settings"
  on agency_billing_settings for all
  using (es_mi_agencia(agency_id))
  with check (es_mi_agencia(agency_id));

-- === Datos fiscales del cliente ===
-- Tabla aparte de `clients` porque `clients` la lee el propio cliente (0008) y
-- aquí no hay nada que esconderle: son sus datos. Aparte de `client_modules`
-- porque ahí sí viven las credenciales.

create table if not exists client_billing_profiles (
  client_id uuid primary key references clients(id) on delete cascade,

  razon_social text not null default '',
  nif text not null default '',
  direccion text not null default '',
  codigo_postal text not null default '',
  ciudad text not null default '',
  provincia text not null default '',
  pais text not null default 'España',

  -- A dónde se manda la factura y con quién se habla de dinero: no siempre es
  -- el correo de quien atiende el WhatsApp.
  email text not null default '',
  telefono text not null default '',
  persona_contacto text not null default '',

  forma_pago text not null default 'transferencia'
    check (forma_pago in ('transferencia', 'domiciliacion', 'tarjeta', 'efectivo', 'otro')),

  -- Nulos = se usa el valor por defecto de la agencia. Un cliente extranjero
  -- con IVA 0 o uno que retiene IRPF son la excepción, no la norma.
  iva numeric(5,2),
  irpf numeric(5,2),
  dias_vencimiento int,

  notas text not null default '',
  updated_at timestamptz not null default now()
);

alter table client_billing_profiles enable row level security;

create policy "agency access to client billing profile"
  on client_billing_profiles for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- El cliente ve sus propios datos fiscales (los necesita para comprobar que la
-- factura sale bien), pero corregirlos pasa por la agencia: cambiar un NIF a
-- mitad de un ejercicio no es un campo de formulario, es una conversación.
create policy "client users read own billing profile"
  on client_billing_profiles for select
  using (es_usuario_del_cliente(client_id));

-- Fila por defecto para los clientes que ya existen y para los que vengan,
-- igual que en 0010: si depende de que alguien se acuerde, algún cliente se
-- queda sin ella.
insert into client_billing_profiles (client_id, razon_social)
select c.id, c.name from clients c
on conflict (client_id) do nothing;

create or replace function crear_ficha_fiscal_del_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into client_billing_profiles (client_id, razon_social)
  values (new.id, new.name)
  on conflict (client_id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_ficha_fiscal_del_cliente_trg on clients;
create trigger crear_ficha_fiscal_del_cliente_trg
  after insert on clients
  for each row execute function crear_ficha_fiscal_del_cliente();

-- === Catálogo de servicios de la agencia ===
-- Lo que la agencia vende, con su precio de tarifa. No lo ve ningún cliente:
-- es la lista de precios completa, y los precios no son iguales para todos.

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  precio numeric(12,2) not null default 0,
  recurrencia text not null default 'mensual'
    check (recurrencia in ('mensual', 'trimestral', 'anual', 'unico')),
  -- Con qué módulo de la plataforma se corresponde, si es que se corresponde
  -- con alguno. Sirve para proponer los servicios al activar un módulo.
  modulo text check (modulo in ('whatsapp', 'voice', 'calendar', 'email', 'social')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists services_agency_idx on services (agency_id);

alter table services enable row level security;

create policy "agency manages own services"
  on services for all
  using (es_mi_agencia(agency_id))
  with check (es_mi_agencia(agency_id));

-- === Lo que tiene contratado cada cliente ===
-- El nombre y el precio se copian del catálogo en vez de referenciarlo: subir
-- la tarifa no puede cambiar retroactivamente lo que paga quien ya firmó.

create table if not exists client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid references services(id) on delete set null,

  nombre text not null,
  descripcion text not null default '',
  precio numeric(12,2) not null default 0,
  cantidad numeric(10,2) not null default 1,
  recurrencia text not null default 'mensual'
    check (recurrencia in ('mensual', 'trimestral', 'anual', 'unico')),

  estado text not null default 'activo'
    check (estado in ('activo', 'pausado', 'cancelado')),

  fecha_alta date not null default current_date,
  fecha_baja date,

  -- Fecha en la que toca meterlo en una factura. La generación mensual mira
  -- este campo y lo adelanta según la recurrencia; en los servicios de una sola
  -- vez lo pone a null, que es como se marca «ya facturado».
  proxima_factura date,

  created_at timestamptz not null default now()
);

create index if not exists client_services_client_idx on client_services (client_id);

alter table client_services enable row level security;

create policy "agency access to client services"
  on client_services for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- El cliente ve qué tiene contratado y a qué precio. Es lo que va a ver en la
-- factura de todas formas.
create policy "client users read own services"
  on client_services for select
  using (es_usuario_del_cliente(client_id));

-- === Facturas ===

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  -- `restrict` y no `cascade`: una factura emitida es un documento contable.
  -- Borrar un cliente no puede llevarse por delante lo que se le facturó.
  client_id uuid not null references clients(id) on delete restrict,

  -- Null mientras es borrador. Se asigna al emitir, y ya no cambia.
  numero text,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'emitida', 'enviada', 'pagada', 'anulada')),

  fecha_emision date not null default current_date,
  fecha_vencimiento date,

  -- Periodo que cubre, para los servicios recurrentes: «septiembre de 2026».
  periodo_inicio date,
  periodo_fin date,
  concepto text not null default '',

  moneda text not null default 'EUR',
  iva_pct numeric(5,2) not null default 21,
  irpf_pct numeric(5,2) not null default 0,

  -- Totales calculados al guardar las líneas. Se guardan y no se recalculan al
  -- leer: una factura emitida tiene que enseñar siempre las mismas cifras,
  -- aunque cambie la forma de redondear del código.
  base numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  irpf numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  forma_pago text not null default 'transferencia',
  -- Enlace de cobro (Stripe Payment Link o similar) si se quiere ofrecer pago
  -- con tarjeta. Opcional: sin integración, se pega a mano y se imprime en el
  -- correo y en el PDF.
  enlace_pago text,

  -- Foto de los datos fiscales el día de la emisión. Ver cabecera del archivo.
  emisor jsonb not null default '{}'::jsonb,
  receptor jsonb not null default '{}'::jsonb,

  notas text not null default '',

  emitida_at timestamptz,
  enviada_at timestamptz,
  pagada_at timestamptz,
  referencia_pago text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sin huecos ni repetidos dentro de una agencia. El índice parcial deja fuera
-- los borradores, que comparten el `numero is null`.
create unique index if not exists invoices_numero_idx
  on invoices (agency_id, numero) where numero is not null;

create index if not exists invoices_client_idx on invoices (client_id, fecha_emision desc);
create index if not exists invoices_agency_idx on invoices (agency_id, fecha_emision desc);

alter table invoices enable row level security;

create policy "agency manages own invoices"
  on invoices for all
  using (es_mi_agencia(agency_id))
  with check (es_mi_agencia(agency_id));

-- El cliente ve sus facturas emitidas, nunca los borradores: un borrador es
-- trabajo interno y puede tener cifras a medias.
create policy "client users read own issued invoices"
  on invoices for select
  using (es_usuario_del_cliente(client_id) and estado <> 'borrador');

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  -- De qué servicio contratado salió, para poder rastrearlo. `set null` porque
  -- dar de baja un servicio no puede borrar la línea de una factura emitida.
  client_service_id uuid references client_services(id) on delete set null,

  concepto text not null,
  descripcion text not null default '',
  cantidad numeric(10,2) not null default 1,
  precio numeric(12,2) not null default 0,
  posicion int not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx on invoice_items (invoice_id, posicion);

alter table invoice_items enable row level security;

create policy "agency manages own invoice items"
  on invoice_items for all
  using (
    exists (
      select 1 from invoices i
      where i.id = invoice_items.invoice_id and es_mi_agencia(i.agency_id)
    )
  )
  with check (
    exists (
      select 1 from invoices i
      where i.id = invoice_items.invoice_id and es_mi_agencia(i.agency_id)
    )
  );

create policy "client users read own invoice items"
  on invoice_items for select
  using (
    exists (
      select 1 from invoices i
      where i.id = invoice_items.invoice_id
        and es_usuario_del_cliente(i.client_id)
        and i.estado <> 'borrador'
    )
  );

-- === Numeración correlativa ===
--
-- En la base y no en el código de Next.js porque el número tiene que salir de
-- una operación atómica: dos facturas emitidas a la vez desde dos pestañas no
-- pueden llevar el mismo. El `for update` bloquea la fila de ajustes hasta que
-- termina la transacción, que es exactamente la garantía que hace falta.

create or replace function siguiente_numero_factura(p_agency_id uuid, p_fecha date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serie text;
  v_ejercicio int;
  v_numero int;
  v_anio int := extract(year from p_fecha)::int;
begin
  -- La función es `security definer`, así que comprueba ella misma de quién es
  -- la agencia. Cuando la llama n8n con `service_role` no hay `auth.uid()` y no
  -- hay nada que comprobar: es tráfico de servidor, no de usuario final.
  if auth.uid() is not null and not es_mi_agencia(p_agency_id) then
    raise exception 'Sin acceso a esa agencia.';
  end if;

  select serie, ejercicio, siguiente_numero
    into v_serie, v_ejercicio, v_numero
  from agency_billing_settings
  where agency_id = p_agency_id
  for update;

  if not found then
    insert into agency_billing_settings (agency_id, ejercicio)
    values (p_agency_id, v_anio)
    returning serie, ejercicio, siguiente_numero
      into v_serie, v_ejercicio, v_numero;
  end if;

  -- Año nuevo, contador a 1. La serie lleva el año dentro, así que no se
  -- repiten números entre ejercicios.
  if v_anio <> v_ejercicio then
    v_ejercicio := v_anio;
    v_numero := 1;
  end if;

  update agency_billing_settings
  set ejercicio = v_ejercicio,
      siguiente_numero = v_numero + 1,
      updated_at = now()
  where agency_id = p_agency_id;

  return v_serie || v_ejercicio::text || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

revoke execute on function siguiente_numero_factura(uuid, date) from public;
grant execute on function siguiente_numero_factura(uuid, date) to authenticated;

-- Fila de ajustes para las agencias que ya existen, con el nombre como razón
-- social de partida.
insert into agency_billing_settings (agency_id, razon_social)
select a.id, a.name from agencies a
on conflict (agency_id) do nothing;
