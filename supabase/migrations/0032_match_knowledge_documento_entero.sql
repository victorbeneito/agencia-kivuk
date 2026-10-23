-- `match_knowledge` devuelve también el documento entero de cada trozo.
--
-- Los documentos se trocean para buscar (unos 1.000 caracteres por trozo), y al
-- bot le llegaban solo los trozos que más se parecían a la pregunta. Caso real
-- (Cestería, 22/10/2026): a «¿y me lo enviáis a domicilio?» llegaron los trozos
-- 2 y 3 del documento de envíos (Baleares, Canarias, Ceuta), y no el 1, que es
-- el que dice «4,99 € en la Península, gratis a partir de 80 €». Con el
-- documento a medias, el modelo rellenó el hueco: «6,50 €», «gratis a partir de
-- 99 €», «con TIPSA». Tres pruebas, tres cifras inventadas distintas.
--
-- La búsqueda sigue siendo por trozos (es lo que encuentra bien); lo que cambia
-- es lo que se le enseña al modelo: `Recoger conocimiento` usa `documento` y
-- pone cada documento una sola vez, entero. Son documentos cortos (en Cestería,
-- 1.400 caracteres de media y 4.100 el más largo).
--
-- Cambia lo que devuelve la función, así que se borra y se crea de nuevo. El
-- workflow desplegado sigue funcionando entre aplicar esto y desplegar el nuevo:
-- la columna de más no la usa.

drop function if exists match_knowledge(uuid, vector, int, float);

create function match_knowledge(
  p_client_id uuid,
  p_embedding vector(1536),
  p_match_count int default 5,
  p_min_similarity float default 0.25
)
returns table (
  content text,
  title text,
  category text,
  source_url text,
  similarity float,
  documento text
)
language sql stable
as $$
  select
    kc.content,
    kd.title,
    kd.category,
    kd.source_url,
    1 - (kc.embedding <=> p_embedding) as similarity,
    kd.content as documento
  from knowledge_chunks kc
  join knowledge_documents kd on kd.id = kc.document_id
  where kc.client_id = p_client_id
    and 1 - (kc.embedding <=> p_embedding) > p_min_similarity
  order by kc.embedding <=> p_embedding
  limit p_match_count;
$$;
