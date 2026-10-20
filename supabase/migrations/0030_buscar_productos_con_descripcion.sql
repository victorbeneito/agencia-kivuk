-- `buscar_productos` devuelve también el texto de la ficha.
--
-- Hasta ahora la descripción solo servía para ENCONTRAR el producto (0017,
-- 0018): a la IA le llegaban nombre, precio y enlace, nada más. Caso real
-- (Cestería, 19/10/2026): en una conversación de garrafas de boca ancha, a
-- «¿tenéis con forro de plástico?» el bot ofreció leñeros con forro de
-- arpillera y acabó diciendo que no había garrafas así. La «Garrafa de boca
-- ancha completa» dice en su ficha «introducidas en una funda de plástico»,
-- pero aunque hubiera salido en la búsqueda, el bot no lo habría podido saber.
--
-- Se devuelve un trozo largo y lo recorta n8n (`Preparar contexto`), que es
-- quien sabe qué frases interesan para cada pregunta. Los 1.500 caracteres son
-- un tope para no mover descripciones enteras de miles de caracteres por cada
-- producto; las frases útiles casi siempre caen antes.
--
-- Cambia lo que devuelve la función, así que hay que borrarla y crearla de
-- nuevo. La búsqueda es la misma de 0018. El bot desplegado sigue funcionando
-- entre aplicar esto y desplegar el nuevo: la columna de más no la usa.

drop function if exists buscar_productos(uuid, text[], int);

create function buscar_productos(
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
  aciertos bigint,
  descripcion text
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
      cp.description,
      (
        select count(*)
        from unnest(p_terminos) t
        where unaccent(lower(cp.name)) like '%' || unaccent(lower(t)) || '%'
      ) as en_nombre,
      (
        select count(*)
        from unnest(p_terminos) t
        -- `\m` es el principio de palabra (0018). El término se escapa porque
        -- viene de lo que ha escrito una persona.
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
    (c.en_nombre + c.en_descripcion)::bigint as aciertos,
    left(c.description, 1500) as descripcion
  from candidatos c, manda_el_nombre m
  where (m.si and c.en_nombre > 0)
     or (not m.si and c.en_descripcion > 0)
  order by c.en_nombre desc, c.en_descripcion desc, c.available desc, c.price asc
  limit p_limite;
$$;
