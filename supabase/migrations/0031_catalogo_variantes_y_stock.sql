-- Tamaños, precios y existencias de cada producto (tiendas Odoo).
--
-- Hasta ahora de cada producto se guardaba UN precio, el que la ficha enseña
-- al abrirla, y la disponibilidad que declara schema.org (que Odoo pone siempre
-- en «InStock»). Caso real (Cestería, 20/10/2026): la «Garrafa de boca ancha
-- completa» se guardaba a 50,38 € y el bot la daba «desde 50,38 €». Odoo dice
-- otra cosa:
--
--     4 litros   36,99 €   10 en stock
--     8 litros   45,24 €   11 en stock
--     16 litros  50,38 €   0, y no admite pedidos sin stock
--
-- Es decir: el «desde» era el más caro, y el de 16 litros que pedía el cliente
-- no se podía comprar. Y Cestería, al preguntarle qué recomendar, contestó «lo
-- ideal es lo que haya en stock, pero si eso no lo puede ver…». Sí puede: la
-- ficha de Odoo pide el precio y las existencias de cada combinación a
-- /sale/get_combination_info_website, que es público.
--
--   odoo           lo que la ingesta lee del HTML para poder preguntar:
--                  { template_id, lineas: [{ atributo, valores: [{ id, nombre }] }] }
--   variantes      lo que contesta Odoo, una por combinación:
--                  [{ nombre, precio, stock, se_puede_pedir }]
--                  Vacío en los productos de una sola opción.
--   variantes_at   cuándo se leyeron, para saber si el stock es de hoy.
--
-- `price` pasa a ser el «desde» de verdad (el más barato que se puede pedir) y
-- `available`, si hay alguna combinación que se pueda pedir. Lo escribe el
-- segundo tramo de la ingesta (`catalogo-ingesta.json`, después de «Resumen»).
--
-- `buscar_productos` devuelve además las variantes. Cambia lo que devuelve, así
-- que se borra y se crea de nuevo.
--
-- Y ordena mejor. Hasta ahora todos los términos valían lo mismo: «cesta» (22
-- productos la llevan en el nombre) contaba igual que «ropero» (2). A «busco
-- una cesta para la ropa» salían diez cestas de Navidad, más baratas, y ningún
-- ropero. Ahora cada término pesa lo contrario de lo común que es en los nombres
-- del catálogo de ese cliente (1 / nº de productos que lo llevan), como hace
-- cualquier buscador: lo raro dice más de lo que se busca que lo de siempre. El
-- filtro no cambia (o manda el nombre o la descripción, 0017); solo el orden.
--
-- Los términos pueden ser frases («capazo de palma con asas cortas»): vienen de
-- los sinónimos de cada cliente y casan con el nombre igual que una palabra.

alter table catalog_products
  add column if not exists odoo jsonb,
  add column if not exists variantes jsonb,
  add column if not exists variantes_at timestamptz;

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
  descripcion text,
  variantes jsonb
)
language sql stable
as $$
  with terminos as (
    -- Cuántos productos del cliente llevan cada término en el nombre.
    select
      unaccent(lower(t)) as t,
      (
        select count(*)
        from catalog_products cp
        where cp.client_id = p_client_id
          and cp.price is not null
          and unaccent(lower(cp.name)) like '%' || unaccent(lower(t)) || '%'
      ) as productos
    from unnest(p_terminos) t
  ),
  candidatos as (
    select
      cp.name,
      cp.price,
      cp.currency,
      cp.url,
      cp.available,
      cp.description,
      cp.variantes,
      (
        select count(*)
        from unnest(p_terminos) t
        where unaccent(lower(cp.name)) like '%' || unaccent(lower(t)) || '%'
      ) as en_nombre,
      (
        select coalesce(sum(1.0 / greatest(tt.productos, 1)), 0)
        from terminos tt
        where unaccent(lower(cp.name)) like '%' || tt.t || '%'
      ) as peso_nombre,
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
    left(c.description, 1500) as descripcion,
    c.variantes
  from candidatos c, manda_el_nombre m
  where (m.si and c.en_nombre > 0)
     or (not m.si and c.en_descripcion > 0)
  -- Primero lo que más pesa en el nombre (términos raros antes que comunes);
  -- a igualdad, lo que más cumple en la descripción, lo disponible y lo barato.
  order by c.peso_nombre desc, c.en_descripcion desc, c.available desc, c.price asc
  limit p_limite;
$$;
