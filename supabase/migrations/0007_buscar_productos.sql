-- Búsqueda de productos por texto, para que el bot dé precios reales.
--
-- El conocimiento curado (0006_rag.sql) explica cómo funciona el negocio; los
-- precios concretos salen de aquí, de `catalog_products`, que se resincroniza
-- con el workflow de ingesta. Un precio en un documento escrito a mano queda
-- desactualizado sin que nadie se entere.

-- Sin unaccent, "lampara" no encuentra "Lámpara colgante de rafia". Por WhatsApp
-- casi nadie escribe con tildes, así que esto no es un refinamiento: es la
-- diferencia entre encontrar el producto y no encontrarlo.
create extension if not exists unaccent with schema extensions;

-- El filtro por client_id va DENTRO de la función, igual que en match_knowledge:
-- así no se puede consultar el catálogo de otro cliente por descuido desde n8n.
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
    ) as aciertos
  from catalog_products cp
  where cp.client_id = p_client_id
    and cp.price is not null
    and exists (
      select 1
      from unnest(p_terminos) t
      where unaccent(lower(cp.name)) like '%' || unaccent(lower(t)) || '%'
    )
  -- Primero lo que más términos de la pregunta cumple, y a igualdad de
  -- aciertos lo disponible antes que lo agotado.
  order by aciertos desc, cp.available desc, cp.price asc
  limit p_limite;
$$;
