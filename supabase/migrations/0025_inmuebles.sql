-- Cartera de inmuebles, para que el bot de una inmobiliaria busque con filtros.
--
-- El conocimiento (0006) busca por parecido de significado y el catálogo (0007)
-- por palabras. Ninguno de los dos entiende «menos de 150.000 € y tres
-- habitaciones», que es justo lo que pregunta quien busca piso: la búsqueda
-- vectorial trae un chalet de 435.000 porque «se parece», y la de palabras no
-- sabe qué es «menos de».
--
-- Así que el reparto es el mismo que en la agenda: la IA solo EXTRAE lo que
-- pide la persona (operación, zona, precio, habitaciones...) y esta función
-- decide qué encaja. La lista que se envía la redacta el código con lo que
-- devuelve, no el modelo: un precio reescrito por un modelo alguna vez sale
-- con una cifra cambiada, y aquí cada cifra es una promesa.
--
-- Va como módulo propio (`inmuebles`): a quien no lo tiene activo, el bot no le
-- cambia en nada.

-- --- el módulo -------------------------------------------------------------
do $$
declare
  nombre_check text;
begin
  -- Como en 0004: el nombre del check lo genera Postgres, así que se busca.
  select con.conname into nombre_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'client_modules'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%module%';

  if nombre_check is not null then
    execute format('alter table client_modules drop constraint %I', nombre_check);
  end if;
end $$;

alter table client_modules
  add constraint client_modules_module_check
  check (module in ('whatsapp', 'voice', 'calendar', 'email', 'social', 'inmuebles'));

-- --- la tabla --------------------------------------------------------------
create table if not exists inmuebles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- La referencia que usa la inmobiliaria y la que escribe quien pregunta
  -- («¿el 104 tiene garaje?»). Única por cliente, no global.
  ref text not null,

  operacion text not null check (operacion in ('venta', 'alquiler')),
  tipo text not null,
  municipio text not null,
  zona text,

  -- En venta, el precio; en alquiler, la renta mensual. Vacío = «a consultar»:
  -- existe en las carteras reales, y un inmueble así no se ofrece a quien pone
  -- un tope de precio, porque no se puede saber si cabe.
  precio numeric(12, 2) check (precio is null or precio >= 0),

  -- Vacíos cuando no aplican: un local no tiene habitaciones, y cero no es lo
  -- mismo que «no aplica».
  habitaciones smallint,
  banos smallint,
  m2 integer,
  m2_parcela integer,

  estado text,

  -- `reservado` se ve en la cartera pero el bot no lo ofrece; `retirado` es
  -- vendido o alquilado, y no se borra para no perder la referencia.
  situacion text not null default 'disponible'
    check (situacion in ('disponible', 'reservado', 'retirado')),

  extras text[] not null default '{}',
  descripcion text,
  url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (client_id, ref)
);

create index if not exists inmuebles_busqueda_idx
  on inmuebles (client_id, situacion, operacion);

alter table inmuebles enable row level security;

create policy "agency access to properties"
  on inmuebles for all
  using (es_agencia_del_cliente(client_id))
  with check (es_agencia_del_cliente(client_id));

-- El cliente la lee; la escribe la agencia (y n8n con service_role).
create policy "client users read own properties"
  on inmuebles for select
  using (es_usuario_del_cliente(client_id));

-- --- utilidades ------------------------------------------------------------
-- Sin tildes y sin mayúsculas, como en buscar_productos: por WhatsApp se
-- escribe «atico», «olleria» y «sant josep» sin tildes ni mayúsculas.
create or replace function inmuebles_norm(t text)
returns text
language sql
stable
as $$
  select trim(regexp_replace(unaccent(lower(coalesce(t, ''))), '\s+', ' ', 'g'));
$$;

-- Los filtros llegan de un JSON que ha escrito un modelo. n8n ya los limpia,
-- pero la función no se fía: una cadena donde se esperaba una lista vale como
-- lista de uno, y lo que no es texto ni lista, como nada.
create or replace function inmuebles_lista(j jsonb)
returns text[]
language sql
stable
as $$
  select case jsonb_typeof(j)
    when 'array' then coalesce(
      (select array_agg(inmuebles_norm(x))
       from jsonb_array_elements_text(j) x
       where inmuebles_norm(x) <> ''),
      '{}')
    when 'string' then
      case when inmuebles_norm(j #>> '{}') = '' then '{}'::text[]
           else array[inmuebles_norm(j #>> '{}')] end
    else '{}'::text[]
  end;
$$;

create or replace function inmuebles_numero(j jsonb)
returns numeric
language sql
stable
as $$
  select case
    when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric
    when jsonb_typeof(j) = 'string' and (j #>> '{}') ~ '^\s*\d+(\.\d+)?\s*$' then (j #>> '{}')::numeric
    else null
  end;
$$;

-- --- lo que hay en la cartera ----------------------------------------------
-- Se le pasa a la IA ANTES de que conteste, para que traduzca lo que dice la
-- persona a los nombres que existen: «San José» a `Sant Josep`, «una casa» a
-- los tipos de casa que hay. Sin esta lista, el modelo se inventa zonas
-- plausibles y la búsqueda no encuentra nada por un nombre mal escrito.
--
-- Solo lo disponible: una zona donde lo único que hay está reservado no es una
-- zona donde se pueda ofrecer nada.
create or replace function inmuebles_cartera(p_client_id uuid)
returns jsonb
language sql
stable
as $$
  with d as (
    select *
    from inmuebles
    where client_id = p_client_id
      and situacion = 'disponible'
  )
  select jsonb_build_object(
    'total', (select count(*) from d),
    'tipos', coalesce(
      (select jsonb_agg(tipo order by tipo) from (select distinct tipo from d) s),
      '[]'::jsonb),
    -- Los municipios, del que más tiene al que menos, cada uno con sus zonas.
    'municipios', coalesce(
      (select jsonb_agg(
         jsonb_build_object('municipio', municipio, 'zonas', zonas)
         order by n desc, municipio)
       from (
         select municipio,
                count(*) as n,
                coalesce(array_agg(distinct zona) filter (where zona is not null), '{}') as zonas
         from d
         group by municipio
       ) s),
      '[]'::jsonb),
    'extras', coalesce(
      (select jsonb_agg(extra order by extra) from (select distinct unnest(extras) as extra from d) s),
      '[]'::jsonb),
    'precios', coalesce(
      (select jsonb_object_agg(operacion, jsonb_build_object('desde', desde, 'hasta', hasta, 'cuantos', n))
       from (
         select operacion, min(precio) as desde, max(precio) as hasta, count(*) as n
         from d
         group by operacion
       ) s),
      '{}'::jsonb)
  );
$$;

-- --- la búsqueda -----------------------------------------------------------
-- Filtros, todos opcionales:
--   refs              ["104"]: devuelve esas fichas y no mira nada más
--   operacion         "venta" | "alquiler"
--   tipos             ["piso", "ático"]
--   municipios        ["Ontinyent"]
--   zonas             ["Sant Josep"]
--   precio_min, precio_max, habitaciones_min, banos_min, m2_min
--   extras            ["garaje", "ascensor"]: tiene que tenerlos todos
--
-- Lo que la persona pone como condición se cumple siempre (operación, tipo,
-- municipio, habitaciones, extras). Dos cosas se aflojan, de una en una y
-- marcadas, solo para rellenar si no hay bastantes que encajen del todo:
--
--   se_pasa    hasta un 10 % por encima del precio máximo. Es lo que haría un
--              comercial: a quien dice «hasta 150.000» se le enseña el de
--              152.000, avisando. Esconderlo sería perder la venta.
--   otra_zona  el precio cumple pero está en otra zona del mismo municipio.
--
-- Nunca las dos a la vez: un piso más caro Y en otra zona ya no es lo que
-- pidió.
--
-- `total_exactos` es cuántos encajan del todo, aunque se devuelvan menos: con
-- eso el mensaje puede decir «tengo 7; si me dices la zona te lo afino».
create or replace function buscar_inmuebles(
  p_client_id uuid,
  p_filtros jsonb default '{}'::jsonb,
  p_limite int default 3
)
returns table (
  ref text,
  operacion text,
  tipo text,
  municipio text,
  zona text,
  precio numeric,
  habitaciones smallint,
  banos smallint,
  m2 integer,
  m2_parcela integer,
  estado text,
  situacion text,
  extras text[],
  descripcion text,
  url text,
  encaje text,
  total_exactos bigint
)
language plpgsql
stable
as $$
declare
  v_filtros jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_refs text[];
  v_operacion text := inmuebles_norm(v_filtros ->> 'operacion');
  v_tipos text[] := inmuebles_lista(v_filtros -> 'tipos');
  v_municipios text[] := inmuebles_lista(v_filtros -> 'municipios');
  v_zonas text[] := inmuebles_lista(v_filtros -> 'zonas');
  v_extras text[] := inmuebles_lista(v_filtros -> 'extras');
  v_precio_min numeric := inmuebles_numero(v_filtros -> 'precio_min');
  v_precio_max numeric := inmuebles_numero(v_filtros -> 'precio_max');
  v_hab_min numeric := inmuebles_numero(v_filtros -> 'habitaciones_min');
  v_banos_min numeric := inmuebles_numero(v_filtros -> 'banos_min');
  v_m2_min numeric := inmuebles_numero(v_filtros -> 'm2_min');
  v_limite int := least(greatest(coalesce(p_limite, 3), 1), 10);
begin
  -- Las referencias se comparan sin la palabra «ref» delante y sin nada que no
  -- sea letra o número: «Ref. 104», «referencia 104» y «104» son la misma.
  select coalesce(array_agg(limpia), '{}')
  into v_refs
  from (
    select regexp_replace(regexp_replace(x, '^(referencia|ref)\W*', ''), '[^a-z0-9]', '', 'g') as limpia
    from unnest(inmuebles_lista(v_filtros -> 'refs')) x
  ) s
  where limpia <> '';

  -- --- por referencia ------------------------------------------------------
  -- Aquí sí sale lo reservado: si preguntan por el 116, hay que poder decir
  -- que está reservado en vez de que no existe. Lo retirado no.
  if cardinality(v_refs) > 0 then
    return query
      select i.ref, i.operacion, i.tipo, i.municipio, i.zona, i.precio,
             i.habitaciones, i.banos, i.m2, i.m2_parcela, i.estado, i.situacion,
             i.extras, i.descripcion, i.url,
             'ref'::text,
             count(*) over ()
      from inmuebles i
      where i.client_id = p_client_id
        and i.situacion <> 'retirado'
        and regexp_replace(lower(i.ref), '[^a-z0-9]', '', 'g') = any (v_refs)
      order by i.ref
      limit v_limite;
    return;
  end if;

  -- --- por criterios -------------------------------------------------------
  return query
    with candidatos as (
      select i.*,
        (cardinality(v_zonas) = 0 or exists (
          select 1 from unnest(v_zonas) z
          where inmuebles_norm(i.zona) like '%' || z || '%'
        )) as zona_ok,
        (v_precio_max is null or (i.precio is not null and i.precio <= v_precio_max)) as precio_ok,
        (v_precio_max is not null and i.precio is not null
          and i.precio > v_precio_max and i.precio <= v_precio_max * 1.10) as precio_cerca
      from inmuebles i
      where i.client_id = p_client_id
        and i.situacion = 'disponible'
        and (v_operacion = '' or i.operacion = v_operacion)
        and (cardinality(v_tipos) = 0 or inmuebles_norm(i.tipo) = any (v_tipos))
        -- Subcadena y no igualdad: «Olleria» tiene que encontrar «L'Olleria».
        and (cardinality(v_municipios) = 0 or exists (
          select 1 from unnest(v_municipios) m
          where inmuebles_norm(i.municipio) like '%' || m || '%'
        ))
        and (v_precio_min is null or (i.precio is not null and i.precio >= v_precio_min))
        and (v_hab_min is null or coalesce(i.habitaciones, 0) >= v_hab_min)
        and (v_banos_min is null or coalesce(i.banos, 0) >= v_banos_min)
        and (v_m2_min is null or coalesce(i.m2, i.m2_parcela, 0) >= v_m2_min)
        -- Todos los extras pedidos. Por subcadena: «piscina» vale para
        -- «piscina comunitaria», y la ficha que se envía dice cuál es.
        and not exists (
          select 1 from unnest(v_extras) e
          where not exists (
            select 1 from unnest(i.extras) ie
            where inmuebles_norm(ie) like '%' || e || '%'
          )
        )
    ),
    clasificados as (
      select c.*,
        case
          when c.zona_ok and c.precio_ok then 'exacto'
          when c.zona_ok and c.precio_cerca then 'se_pasa'
          when not c.zona_ok and c.precio_ok then 'otra_zona'
        end as como
      from candidatos c
    )
    select k.ref, k.operacion, k.tipo, k.municipio, k.zona, k.precio,
           k.habitaciones, k.banos, k.m2, k.m2_parcela, k.estado, k.situacion,
           k.extras, k.descripcion, k.url,
           k.como,
           (select count(*) from clasificados x where x.como = 'exacto')
    from clasificados k
    where k.como is not null
    order by
      case k.como when 'exacto' then 0 when 'se_pasa' then 1 else 2 end,
      -- Con tope de precio, primero lo que más se acerca a él: a quien tiene
      -- 150.000 le interesa antes el de 142.000 que el de 95.000. Sin tope, de
      -- más barato a más caro.
      case when v_precio_max is not null and k.como = 'exacto' then -k.precio else k.precio end
        nulls last,
      k.ref
    limit v_limite;
end;
$$;
