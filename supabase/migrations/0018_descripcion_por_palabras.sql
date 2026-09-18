-- El plan B de 0017 buscaba subcadenas dentro de la descripción, y eso da
-- resultados absurdos.
--
-- «para la leña» deja el término en `lena`, y `lena` está dentro de «relleno» y
-- «rellena» (rel-LENA-r). Resultado: a quien preguntaba por un leñero se le
-- ofrecía «2 kg. Viruta de papel para relleno cestas». Antes de 0017 no salía
-- nada, así que la mejora empeoró ese caso: ofrecer lo que no es resulta peor
-- que no ofrecer nada, porque el cliente se cree la respuesta.
--
-- La descripción es texto largo y corrido, así que le pasa esto mucho más que
-- al nombre. Se le exige por tanto que el término empiece una palabra, no que
-- aparezca en cualquier posición.
--
-- Empezar la palabra y no ser la palabra entera: los términos llegan ya en
-- singular desde n8n («capazos» -> «capazo»), y exigir coincidencia exacta
-- dejaría fuera la descripción que dice «capazos». Con `\m` delante, `capazo`
-- encuentra «capazos» y `lena` no encuentra «rellena».
--
-- El nombre se queda como estaba, con LIKE de subcadena. Ahí funciona bien
-- porque son tres o cuatro palabras elegidas, no prosa, y endurecerlo ahora
-- arriesgaría lo que ya acierta.

create or replace function buscar_productos(
  p_client_id uuid,
  p_terminos text[],
  p_limite int default 6
)
returns table (
  name text,
  price numeric,
  currency text,
  url text,
  available boolean,
  aciertos bigint
)
language sql stable
as $$
  with candidatos as (
    select
      cp.name,
      cp.price,
      cp.currency,
      cp.url,
      cp.available,
      (
        select count(*)
        from unnest(p_terminos) t
        where unaccent(lower(cp.name)) like '%' || unaccent(lower(t)) || '%'
      ) as en_nombre,
      (
        select count(*)
        from unnest(p_terminos) t
        -- `\m` es el principio de palabra en las expresiones regulares de
        -- Postgres. El término se escapa porque viene de lo que ha escrito una
        -- persona: un paréntesis suelto haría fallar la consulta entera.
        where unaccent(lower(coalesce(cp.description, '')))
              ~ ('\m' || regexp_replace(unaccent(lower(t)), '([^a-z0-9])', '\\\1', 'g'))
      ) as en_descripcion
    from catalog_products cp
    where cp.client_id = p_client_id
      and cp.price is not null
  ),
  -- O manda el nombre, o no hay ninguno y entonces se abre la descripción.
  -- Nunca se mezclan los dos, que es lo que metería ruido.
  manda_el_nombre as (
    select exists (select 1 from candidatos where en_nombre > 0) as si
  )
  select
    c.name,
    c.price,
    c.currency,
    c.url,
    c.available,
    (c.en_nombre + c.en_descripcion)::bigint as aciertos
  from candidatos c, manda_el_nombre m
  where (m.si and c.en_nombre > 0)
     or (not m.si and c.en_descripcion > 0)
  order by c.en_nombre desc, c.en_descripcion desc, c.available desc, c.price asc
  limit p_limite;
$$;
