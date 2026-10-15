-- Lo «más caro» que ofrece `buscar_inmuebles` tiene un límite: un tercio por
-- encima del tope.
--
-- Tercera prueba de verdad (15/10/2026), chalets con 200.000 €:
--
--   «No tengo chalets... el más económico está en 240.000 €. ¿Te los enseño?»
--   «Sí»                       → 240.000, 265.000 y 435.000 (al aceptar se
--                                 quitaba el tope del todo)
--   «Máximo 250.000»           → «aparte de lo enseñado no tengo nada», bien,
--                                 pero ofrecía el de 560.000
--
-- Pasarse 20.000 o 40.000 se le puede proponer a alguien; 300.000 no. Desde
-- aquí:
--
--   mas_caros / mas_caros_desde   solo cuenta lo que no pasa de un tercio
--                                 por encima (200.000 → hasta 266.667);
--                                 si no hay nada ahí, no hay oferta
--   tope_ampliado (filtro)        lo pone el bot al aceptar esa oferta, con
--                                 el tope ya subido ese tercio: sin el 10 %
--                                 de margen encima (sería pasarse dos veces)
--                                 y del más barato al más caro, que es lo
--                                 que se le acaba de anunciar
--
-- Misma forma de respuesta que 0026 y 0027: el bot desplegado sigue
-- funcionando entre aplicar esto y desplegar el nuevo.

create or replace function buscar_inmuebles(
  p_client_id uuid,
  p_filtros jsonb default '{}'::jsonb,
  p_limite int default 3
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_filtros jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_refs text[];
  v_excluir text[];
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
  v_tope_ampliado boolean := coalesce(v_filtros ->> 'tope_ampliado', '') = 'true';
  v_limite int := least(greatest(coalesce(p_limite, 3), 1), 10);
  v_resultado jsonb;
begin
  -- «Ref. 104», «referencia 104» y «104» son la misma (como en 0025).
  select coalesce(array_agg(limpia), '{}') into v_refs
  from (
    select regexp_replace(regexp_replace(x, '^(referencia|ref)\W*', ''), '[^a-z0-9]', '', 'g') as limpia
    from unnest(inmuebles_lista(v_filtros -> 'refs')) x
  ) s
  where limpia <> '';

  select coalesce(array_agg(limpia), '{}') into v_excluir
  from (
    select regexp_replace(regexp_replace(x, '^(referencia|ref)\W*', ''), '[^a-z0-9]', '', 'g') as limpia
    from unnest(inmuebles_lista(v_filtros -> 'excluir_refs')) x
  ) s
  where limpia <> '';

  -- --- por referencia ------------------------------------------------------
  -- Lo reservado sí sale, para poder decir que está reservado; lo retirado no.
  -- Aquí no se excluye nada: si pregunta por el 104, quiere el 104.
  if cardinality(v_refs) > 0 then
    select jsonb_build_object(
      'filas', coalesce(jsonb_agg(to_jsonb(f) order by f.ref), '[]'::jsonb),
      'total_exactos', count(*),
      'vistos', 0,
      'otras_zonas', 0,
      'otros_municipios', 0,
      'municipios_fuera', '[]'::jsonb,
      'mas_caros', 0,
      'mas_caros_desde', null
    )
    into v_resultado
    from (
      select i.ref, i.operacion, i.tipo, i.municipio, i.zona, i.precio,
             i.habitaciones, i.banos, i.m2, i.m2_parcela, i.estado, i.situacion,
             i.extras, i.descripcion, i.url, 'ref'::text as encaje
      from inmuebles i
      where i.client_id = p_client_id
        and i.situacion <> 'retirado'
        and regexp_replace(lower(i.ref), '[^a-z0-9]', '', 'g') = any (v_refs)
      order by i.ref
      limit v_limite
    ) f;
    return v_resultado;
  end if;

  -- --- por criterios -------------------------------------------------------
  -- El municipio ya no filtra aquí, como antes: se marca (`municipio_ok`) para
  -- poder contar lo que hay en otros pueblos. Lo demás que la persona pone como
  -- condición (operación, tipo, habitaciones, extras...) se sigue cumpliendo
  -- siempre.
  with candidatos as (
    select i.*,
      regexp_replace(lower(i.ref), '[^a-z0-9]', '', 'g') = any (v_excluir) as visto,
      (cardinality(v_municipios) = 0 or exists (
        select 1 from unnest(v_municipios) m
        where inmuebles_norm(i.municipio) like '%' || m || '%'
      )) as municipio_ok,
      (cardinality(v_zonas) = 0 or exists (
        select 1 from unnest(v_zonas) z
        where inmuebles_norm(i.zona) like '%' || z || '%'
      )) as zona_ok,
      (v_precio_max is null or (i.precio is not null and i.precio <= v_precio_max)) as precio_ok,
      (v_precio_max is not null and i.precio is not null and not v_tope_ampliado
        and i.precio > v_precio_max and i.precio <= v_precio_max * 1.10) as precio_cerca,
      -- Más caro, pero hasta un tercio por encima del tope como mucho: a quien
      -- tiene 200.000 se le puede proponer uno de 240.000, no uno de 560.000.
      (v_precio_max is not null and i.precio is not null
        and i.precio > v_precio_max * (case when v_tope_ampliado then 1 else 1.10 end)
        and i.precio * 3 <= v_precio_max * 4) as precio_alto
    from inmuebles i
    where i.client_id = p_client_id
      and i.situacion = 'disponible'
      and (v_operacion = '' or i.operacion = v_operacion)
      and (cardinality(v_tipos) = 0 or inmuebles_norm(i.tipo) = any (v_tipos))
      and (v_precio_min is null or (i.precio is not null and i.precio >= v_precio_min))
      and (v_hab_min is null or coalesce(i.habitaciones, 0) >= v_hab_min)
      and (v_banos_min is null or coalesce(i.banos, 0) >= v_banos_min)
      and (v_m2_min is null or coalesce(i.m2, i.m2_parcela, 0) >= v_m2_min)
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
        when c.municipio_ok and c.zona_ok and c.precio_ok then 'exacto'
        -- Se pasa un poco del tope (hasta un 10 %): se enseña avisando, como
        -- haría un comercial, pero solo para completar, detrás de los exactos.
        when c.municipio_ok and c.zona_ok and c.precio_cerca then 'se_pasa'
        when c.municipio_ok and not c.zona_ok and c.precio_ok then 'otra_zona'
        -- Otro pueblo: con el precio que cumple o que se pasa poco, porque
        -- ahí ya se está proponiendo otra cosa y se enseñará avisando.
        when not c.municipio_ok and (c.precio_ok or c.precio_cerca) then 'otro_municipio'
        when c.municipio_ok and c.zona_ok and c.precio_alto then 'mas_caro'
      end as encaje
    from candidatos c
  ),
  elegidos as (
    select k.*
    from clasificados k
    where not k.visto
      and k.encaje in ('exacto', 'se_pasa')
    order by
      case k.encaje when 'exacto' then 0 else 1 end,
      -- Con tope de precio, primero lo que más se acerca a él: a quien tiene
      -- 150.000 le interesa antes el de 142.000 que el de 95.000. Sin tope, de
      -- más barato a más caro.
      case when v_precio_max is not null and not v_tope_ampliado and k.encaje = 'exacto' then -k.precio else k.precio end
        nulls last,
      k.ref
    limit v_limite
  )
  select jsonb_build_object(
    'filas', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'ref', e.ref, 'operacion', e.operacion, 'tipo', e.tipo,
         'municipio', e.municipio, 'zona', e.zona, 'precio', e.precio,
         'habitaciones', e.habitaciones, 'banos', e.banos, 'm2', e.m2,
         'm2_parcela', e.m2_parcela, 'estado', e.estado, 'situacion', e.situacion,
         'extras', e.extras, 'descripcion', e.descripcion, 'url', e.url,
         'encaje', e.encaje)
       order by
         case e.encaje when 'exacto' then 0 else 1 end,
         case when v_precio_max is not null and not v_tope_ampliado and e.encaje = 'exacto' then -e.precio else e.precio end
           nulls last,
         e.ref)
       from elegidos e),
      '[]'::jsonb),
    -- Los que encajan del todo y no se han enseñado todavía.
    'total_exactos', (select count(*) from clasificados x where x.encaje = 'exacto' and not x.visto),
    -- Los que encajan del todo pero ya se enseñaron.
    'vistos', (select count(*) from clasificados x where x.encaje = 'exacto' and x.visto),
    -- Aflojando una sola cosa, sin contar lo ya enseñado:
    'otras_zonas', (select count(*) from clasificados x where x.encaje = 'otra_zona' and not x.visto),
    'otros_municipios', (select count(*) from clasificados x where x.encaje = 'otro_municipio' and not x.visto),
    'municipios_fuera', coalesce(
      (select jsonb_agg(m order by m)
       from (select distinct x.municipio as m from clasificados x where x.encaje = 'otro_municipio' and not x.visto) s),
      '[]'::jsonb),
    'mas_caros', (select count(*) from clasificados x where x.encaje = 'mas_caro' and not x.visto),
    'mas_caros_desde', (select min(x.precio) from clasificados x where x.encaje = 'mas_caro' and not x.visto)
  )
  into v_resultado;

  return v_resultado;
end;
$$;
