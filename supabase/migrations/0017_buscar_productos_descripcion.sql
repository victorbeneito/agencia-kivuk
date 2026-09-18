-- `buscar_productos` mira también la descripción, pero solo si el nombre falla.
--
-- El motivo salió de una prueba del cliente. Cuando alguien pide algo genérico
-- ("busco un cesto") lo suyo es preguntarle para qué lo quiere antes de soltarle
-- seis productos variados. Pero la búsqueda de catálogo se hace ANTES del
-- modelo, con el mensaje del usuario, así que la respuesta corta que llega
-- después tiene que encontrar algo ella sola. Y no lo encontraba:
--
--   «para la playa»  -> 0 productos   (ningún nombre contiene "playa")
--   «para la ropa»   -> cestos genéricos de esparto, no los de ropa
--
-- Las descripciones sí lo dicen: 12 hablan de playa, 3 de ropa. Con el nombre
-- solo, preguntar habría sido peor que no preguntar.
--
-- Va como plan B y no como búsqueda ampliada a propósito. Las descripciones son
-- texto comercial largo, y una palabra como "natural" aparece en casi todas:
-- buscar siempre en ellas convertiría cualquier consulta vaga en seis productos
-- al azar. Así, quien pregunta por "lámpara" sigue recibiendo exactamente lo
-- mismo que antes, y solo cuando no hay ni un nombre que encaje se mira dentro.
--
-- Lo que esto NO arregla: «para la leña» sigue sin encontrar los leñeros, porque
-- "leña" no es subcadena de "leñero" y ninguna descripción la menciona. Eso se
-- resuelve por el otro lado, con un documento de conocimiento que traduce lo que
-- busca la gente al nombre de la familia.

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
        where unaccent(lower(coalesce(cp.description, ''))) like '%' || unaccent(lower(t)) || '%'
      ) as en_descripcion
    from catalog_products cp
    where cp.client_id = p_client_id
      and cp.price is not null
  ),
  -- Se decide una sola vez para toda la consulta: o manda el nombre, o no hay
  -- ninguno y entonces se abre la descripción. Nunca se mezclan los dos, que es
  -- lo que metería ruido.
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
  -- Primero lo que más términos cumple en el nombre, luego en la descripción, y
  -- a igualdad lo disponible antes que lo agotado.
  order by c.en_nombre desc, c.en_descripcion desc, c.available desc, c.price asc
  limit p_limite;
$$;
