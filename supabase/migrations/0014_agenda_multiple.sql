-- Agenda con varios trabajadores y varios servicios.
--
-- Hasta ahora un negocio era una agenda: un `calendar_id`, un horario y una
-- duración de cita, todo dentro de `client_modules.config` del módulo
-- `calendar`. Sirve para un autónomo y se rompe con el primer negocio de dos
-- personas: una peluquería donde Ana, Bea y Sonia atienden a la vez, y donde
-- las mechas solo las hacen dos de ellas y duran cuatro veces más que un corte.
--
-- Cuatro decisiones que condicionan todo lo demás:
--
--   1. **La verdad pasa a estar aquí, no en Google.** Hasta hoy la única copia
--      de una cita era el evento de Google Calendar, y el solape se detectaba
--      con `freeBusy`. Eso no aguanta varios trabajadores: `freeBusy` devuelve
--      franjas ocupadas *anónimas* —dice "de 17 a 18 ocupado", no de quién—, y
--      con ellas no se puede saber si quien está libre es Ana o Bea. Las citas
--      viven en `appointments`, con una restricción que impide físicamente que
--      dos se solapen en la misma persona, y Google queda como espejo.
--   2. **Un calendario de Google por trabajador, y opcional.** Es lo que hacen
--      Booksy, Fresha o Doctoralia, y por el mismo motivo del punto anterior.
--      Sirve para dos cosas: que cada persona vea sus citas en el móvil, y que
--      si se bloquea un rato para ir al médico, el bot lo respete. Como ya no
--      es la fuente de la verdad, `calendar_id` puede quedarse vacío y el
--      negocio funciona igual. Las credenciales de Google siguen siendo una
--      sola, las del negocio, en el módulo: no hay OAuth por trabajador.
--   3. **La duración es del servicio, no del negocio.** `duracion_min` del
--      módulo se queda como valor por defecto de quien no defina servicios.
--      Un lavado, un corte y unas mechas en la misma visita son una cita con
--      tres servicios y la duración es la suma, por eso `appointment_services`
--      es una tabla y no una columna.
--   4. **El horario es del trabajador, por día.** El modelo de mañana/tarde
--      iguales toda la semana no describe una peluquería real, donde el sábado
--      es solo por la mañana y cada persona libra un día distinto.
--
-- Los servicios reservables NO son la tabla `services` de 0013: aquella es el
-- catálogo de lo que la agencia le vende al cliente (facturación). Estos son
-- los que el cliente le vende a su público. De ahí el prefijo `booking_`.

-- Para la restricción anti-solape hace falta comparar un uuid con `=` dentro de
-- un índice gist, y eso lo aporta btree_gist. Viene con Supabase, solo hay que
-- activarlo, en el mismo esquema que pgvector (0006).
create extension if not exists btree_gist with schema extensions;

-- === Trabajadores ===
-- Quien atiende. En un negocio de una sola persona hay exactamente una fila, y
-- la regla del motor de agenda es que con un solo trabajador nunca se le nombra
-- en los mensajes: así el nombre que traiga puesto da igual.

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  nombre text not null,

  -- Calendario de Google de esta persona, si lo tiene. Opcional a propósito:
  -- es el espejo, no la fuente. Vacío = sus citas solo viven en Supabase.
  calendar_id text,

  -- Un trabajador no se borra, se desactiva: sus citas pasadas tienen que
  -- seguir contando. `activo = false` lo saca del reparto sin tocar historial.
  activo boolean not null default true,

  -- Desempate cuando varios pueden atender y el cliente no pide a nadie.
  orden int not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists staff_client_idx on staff (client_id, activo);

-- Necesarias para las claves compuestas de más abajo: son las que impiden
-- enlazar el trabajador de un cliente con el servicio de otro.
-- Se añade solo si no está: un `drop ... if exists` delante no vale, porque al
-- reejecutar el fichero de ella ya cuelgan las claves ajenas de más abajo y el
-- drop falla.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_id_client_key' and conrelid = 'staff'::regclass
  ) then
    alter table staff add constraint staff_id_client_key unique (id, client_id);
  end if;
end $$;

-- === Horario de cada trabajador ===
-- Una fila por tramo y día: el sábado de 09:00 a 14:00 es una fila, y el jueves
-- partido son dos. Los días van 1..7 (lunes..domingo), como el selector del
-- panel y como `dias_laborables` en n8n.
--
-- Sin filas para un día, ese día no trabaja. Sin filas en absoluto, no trabaja
-- nunca: por eso el panel tiene que crear a todo trabajador nuevo con un
-- horario ya puesto, y no con la tabla vacía.

create table if not exists staff_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  dia_semana int not null check (dia_semana between 1 and 7),
  hora_inicio time not null,
  hora_fin time not null,

  check (hora_fin > hora_inicio),
  unique (staff_id, dia_semana, hora_inicio)
);

create index if not exists staff_hours_staff_idx on staff_hours (staff_id, dia_semana);

-- === Ausencias ===
-- Vacaciones, bajas y el rato del médico. Con hora de inicio y fin en vez de
-- solo fechas porque el caso corto es el más frecuente.
--
-- No se deduce de Google: los eventos de todo el día se crean a menudo como
-- "libre" y entonces `freeBusy` no los devuelve. Una semana de vacaciones que
-- el bot no ve es una semana de citas que nadie va a atender.

create table if not exists staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text not null default '',
  created_at timestamptz not null default now(),

  check (fin > inicio)
);

create index if not exists staff_time_off_staff_idx on staff_time_off (staff_id, inicio);

-- === Servicios reservables ===
-- Lo que el cliente final pide: "corte", "mechas", "limpieza dental".
--
-- Sin precio, y es a propósito. Los precios que dice el bot salen del
-- conocimiento y del catálogo (0006, 0003); una segunda fuente de precios es
-- exactamente la forma de acabar diciendo dos cifras distintas.

create table if not exists booking_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  nombre text not null,

  duracion_min int not null default 60
    check (duracion_min > 0 and duracion_min <= 600),

  -- Cómo lo llama la gente por WhatsApp: "mechitas", "tinte", "revisión".
  -- El emparejamiento del texto libre con el servicio lo hace el código sobre
  -- esta lista, no el modelo: es la misma decisión que en `buscar_productos`.
  alias text[] not null default '{}',

  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists booking_services_client_idx on booking_services (client_id, activo);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_services_id_client_key'
      and conrelid = 'booking_services'::regclass
  ) then
    alter table booking_services
      add constraint booking_services_id_client_key unique (id, client_id);
  end if;
end $$;

-- === Quién hace qué ===
-- La matriz servicio × trabajador. Es la que contesta "las mechas solo las
-- hacen Bea y Sonia", y con varios servicios en la misma visita, los candidatos
-- son la intersección: quien pueda hacerlos todos.
--
-- Un servicio sin ninguna fila aquí no lo hace nadie y no se puede reservar.
-- El panel avisa de eso al guardar; dejarlo pasar en silencio sería un servicio
-- que el bot ofrece y nunca puede confirmar.

create table if not exists booking_service_staff (
  -- Repetido aquí, y no deducido, para que las dos claves compuestas de abajo
  -- puedan comprobar que servicio y trabajador son del MISMO cliente. Sin eso,
  -- nada impide colgar a Ana de un servicio de otro negocio.
  client_id uuid not null references clients(id) on delete cascade,
  booking_service_id uuid not null,
  staff_id uuid not null,

  primary key (booking_service_id, staff_id),

  foreign key (booking_service_id, client_id)
    references booking_services (id, client_id) on delete cascade,
  foreign key (staff_id, client_id)
    references staff (id, client_id) on delete cascade
);

create index if not exists booking_service_staff_staff_idx
  on booking_service_staff (staff_id);

-- === Citas ===
-- La fuente de la verdad. `google_event_id` es el espejo: si está a null, la
-- cita existe igual.

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Sin `on delete cascade` ni `restrict`: por defecto es `no action`, que se
  -- comprueba al final de la sentencia. Así borrar un trabajador con citas
  -- falla (que es lo que se quiere: se desactiva, no se borra), pero borrar el
  -- cliente entero funciona, porque para entonces sus citas ya han caído.
  staff_id uuid not null,
  foreign key (staff_id, client_id) references staff (id, client_id),

  inicio timestamptz not null,
  fin timestamptz not null,

  estado text not null default 'confirmada'
    check (estado in ('confirmada', 'cancelada')),

  -- Quién viene. El teléfono es el de WhatsApp, y el email puede faltar: por
  -- voz el reconocimiento lo destroza y aun así la cita se crea.
  nombre_contacto text not null default '',
  contacto text not null default '',
  email text,
  notas text not null default '',

  canal text not null default 'whatsapp'
    check (canal in ('whatsapp', 'voice', 'panel', 'otro')),
  conversation_id uuid references conversations(id) on delete set null,

  google_event_id text,

  -- Lo mira el cron de recordatorios para no mandar dos veces el mismo aviso.
  recordatorio_enviado_at timestamptz,

  created_at timestamptz not null default now(),

  check (fin > inicio),

  -- Dos conversaciones a la vez pueden pedir el mismo hueco con la misma
  -- persona, y comprobar antes de insertar no lo evita: entre la comprobación y
  -- el insert cabe la otra reserva. Esto sí lo evita, porque lo impide la base.
  -- Las canceladas quedan fuera: liberan su hueco.
  constraint appointments_sin_solape exclude using gist (
    staff_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado = 'confirmada')
);

create index if not exists appointments_client_idx on appointments (client_id, inicio);
create index if not exists appointments_staff_idx on appointments (staff_id, inicio);

-- Los recordatorios pendientes son unos pocos entre todo el histórico.
create index if not exists appointments_recordatorio_idx
  on appointments (inicio)
  where estado = 'confirmada' and recordatorio_enviado_at is null;

-- === Qué se hace en cada cita ===
-- Una visita puede ser lavado + corte + mechas. El nombre y la duración se
-- copian en vez de referenciarse, por el mismo motivo que en `invoice_items`
-- (0013): renombrar o retirar un servicio no puede reescribir lo que pasó.

create table if not exists appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  booking_service_id uuid references booking_services(id) on delete set null,

  nombre text not null,
  duracion_min int not null,
  posicion int not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists appointment_services_appointment_idx
  on appointment_services (appointment_id, posicion);

-- === Row Level Security ===
-- El criterio de 0008, sin novedades: la agencia gestiona, el cliente lee.
-- Crear un trabajador, mover un horario o reservar una cita son escrituras que
-- pasan por server actions con `service_role`, o por n8n. El navegador del
-- cliente no escribe en ninguna de estas tablas.

alter table staff enable row level security;
alter table staff_hours enable row level security;
alter table staff_time_off enable row level security;
alter table booking_services enable row level security;
alter table booking_service_staff enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;

drop policy if exists "agency access to staff" on staff;
create policy "agency access to staff"
  on staff for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "client users read own staff" on staff;
create policy "client users read own staff"
  on staff for select
  using (es_usuario_del_cliente(client_id));

drop policy if exists "agency access to staff hours" on staff_hours;
create policy "agency access to staff hours"
  on staff_hours for all
  using (
    exists (
      select 1 from staff s
      where s.id = staff_hours.staff_id and es_agencia_del_cliente(s.client_id)
    )
  )
  with check (
    exists (
      select 1 from staff s
      where s.id = staff_hours.staff_id and es_agencia_del_cliente(s.client_id)
    )
  );

drop policy if exists "client users read own staff hours" on staff_hours;
create policy "client users read own staff hours"
  on staff_hours for select
  using (
    exists (
      select 1 from staff s
      where s.id = staff_hours.staff_id and es_usuario_del_cliente(s.client_id)
    )
  );

drop policy if exists "agency access to staff time off" on staff_time_off;
create policy "agency access to staff time off"
  on staff_time_off for all
  using (
    exists (
      select 1 from staff s
      where s.id = staff_time_off.staff_id and es_agencia_del_cliente(s.client_id)
    )
  )
  with check (
    exists (
      select 1 from staff s
      where s.id = staff_time_off.staff_id and es_agencia_del_cliente(s.client_id)
    )
  );

drop policy if exists "client users read own staff time off" on staff_time_off;
create policy "client users read own staff time off"
  on staff_time_off for select
  using (
    exists (
      select 1 from staff s
      where s.id = staff_time_off.staff_id and es_usuario_del_cliente(s.client_id)
    )
  );

drop policy if exists "agency access to booking services" on booking_services;
create policy "agency access to booking services"
  on booking_services for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "client users read own booking services" on booking_services;
create policy "client users read own booking services"
  on booking_services for select
  using (es_usuario_del_cliente(client_id));

drop policy if exists "agency access to booking service staff" on booking_service_staff;
create policy "agency access to booking service staff"
  on booking_service_staff for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "client users read own booking service staff" on booking_service_staff;
create policy "client users read own booking service staff"
  on booking_service_staff for select
  using (es_usuario_del_cliente(client_id));

drop policy if exists "agency access to appointments" on appointments;
create policy "agency access to appointments"
  on appointments for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

drop policy if exists "client users read own appointments" on appointments;
create policy "client users read own appointments"
  on appointments for select
  using (es_usuario_del_cliente(client_id));

drop policy if exists "agency access to appointment services" on appointment_services;
create policy "agency access to appointment services"
  on appointment_services for all
  using (
    exists (
      select 1 from appointments a
      where a.id = appointment_services.appointment_id
        and es_agencia_del_cliente(a.client_id)
    )
  )
  with check (
    exists (
      select 1 from appointments a
      where a.id = appointment_services.appointment_id
        and es_agencia_del_cliente(a.client_id)
    )
  );

drop policy if exists "client users read own appointment services" on appointment_services;
create policy "client users read own appointment services"
  on appointment_services for select
  using (
    exists (
      select 1 from appointments a
      where a.id = appointment_services.appointment_id
        and es_usuario_del_cliente(a.client_id)
    )
  );

-- === Traspaso de los clientes que ya tienen agenda ===
-- A cada cliente con el módulo `calendar` activo se le crea un trabajador con
-- su calendario y su horario actuales. Es lo que evita el camino doble: en vez
-- de que el motor tenga que saber funcionar "con trabajadores" y "sin ellos"
-- —dos ramas, una de las cuales casi nunca se prueba—, todo cliente con agenda
-- tiene al menos uno y solo hay un camino.
--
-- Los valores por defecto son los mismos que `HORARIO_POR_DEFECTO` en el panel
-- y que los del nodo `Calcular huecos` en n8n.

do $$
declare
  m record;
  cfg jsonb;
  nuevo_staff uuid;
  dias int[];
  dia int;
  m_ini text;
  m_fin text;
  t_ini text;
  t_fin text;
begin
  for m in
    select cm.client_id, cm.config
    from client_modules cm
    where cm.module = 'calendar'
      and cm.active
      and not exists (select 1 from staff s where s.client_id = cm.client_id)
  loop
    cfg := coalesce(m.config, '{}'::jsonb);

    insert into staff (client_id, nombre, calendar_id)
    values (m.client_id, 'Principal', nullif(cfg->>'calendar_id', ''))
    returning id into nuevo_staff;

    dias := array(
      select trim(d)::int
      from unnest(
        string_to_array(coalesce(nullif(cfg->>'dias_laborables', ''), '1,2,3,4,5'), ',')
      ) as d
      where trim(d) ~ '^[1-7]$'
    );
    if coalesce(array_length(dias, 1), 0) = 0 then
      dias := array[1, 2, 3, 4, 5];
    end if;

    -- Un tramo solo cuenta si tiene sus dos extremos: el panel permite dejar la
    -- tarde vacía, y medio tramo no es un horario.
    m_ini := nullif(cfg->>'manana_inicio', '');
    m_fin := nullif(cfg->>'manana_fin', '');
    t_ini := nullif(cfg->>'tarde_inicio', '');
    t_fin := nullif(cfg->>'tarde_fin', '');
    if m_ini is null or m_fin is null then
      m_ini := null;
      m_fin := null;
    end if;
    if t_ini is null or t_fin is null then
      t_ini := null;
      t_fin := null;
    end if;
    if m_ini is null and t_ini is null then
      m_ini := '09:00'; m_fin := '14:00';
      t_ini := '16:00'; t_fin := '20:00';
    end if;

    foreach dia in array dias loop
      if m_ini is not null then
        insert into staff_hours (staff_id, dia_semana, hora_inicio, hora_fin)
        values (nuevo_staff, dia, m_ini::time, m_fin::time);
      end if;
      if t_ini is not null then
        insert into staff_hours (staff_id, dia_semana, hora_inicio, hora_fin)
        values (nuevo_staff, dia, t_ini::time, t_fin::time);
      end if;
    end loop;
  end loop;
end $$;
