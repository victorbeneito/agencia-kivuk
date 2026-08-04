-- Base de conocimiento con RAG (multi-cliente).
--
-- Sustituye al campo de texto `agent_configs.knowledge_base`, que se metía
-- entero en el prompt: no escala, se paga en cada mensaje y despista al modelo.
-- Aquí el conocimiento se trocea, se indexa como vectores y en cada mensaje se
-- recuperan solo los fragmentos relevantes.
--
-- El filtro por `client_id` es la frontera entre clientes: va dentro de la
-- función de búsqueda para que no se pueda consultar sin él por descuido.

-- pgvector viene con Supabase; solo hay que activarlo. Se instala en el
-- esquema `extensions`, que ya está en el search_path por defecto.
create extension if not exists vector with schema extensions;

-- === Documentos curados ===
-- La unidad que se crea y edita desde el panel. Un documento = una duda que un
-- cliente final puede tener ("¿cuánto tarda el envío?"), escrito para responderla.
create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  title text not null,
  category text not null default 'faq'
    check (category in ('empresa', 'envio', 'devolucion', 'producto',
                        'faq', 'pago')),
  content text not null,
  source_url text,                      -- si vino de una página concreta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_documents_client_idx
  on knowledge_documents (client_id, category);

-- === Trozos indexados ===
-- Lo que realmente se busca. Se borran y regeneran enteros cada vez que se
-- guarda el documento: es más simple que llevar la cuenta de qué cambió, y
-- garantiza que nunca haya un trozo huérfano con texto viejo.
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  document_id uuid references knowledge_documents(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),               -- text-embedding-3-small
  created_at timestamptz not null default now()
);

-- HNSW en lugar de ivfflat: ivfflat necesita entrenarse con datos ya cargados
-- para dar buenos resultados, y aquí el índice se crea con la tabla vacía.
-- HNSW funciona bien desde el primer trozo insertado.
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists knowledge_chunks_client_idx
  on knowledge_chunks (client_id);

-- Para borrar los trozos de un documento al reindexarlo.
create index if not exists knowledge_chunks_document_idx
  on knowledge_chunks (document_id);

-- === Row Level Security ===
-- Mismo patrón que el resto de tablas por cliente (ver 0001_init.sql).
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

create policy "agency or client access to knowledge documents"
  on knowledge_documents for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

create policy "agency or client access to knowledge chunks"
  on knowledge_chunks for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

-- === Búsqueda ===
-- Devuelve los fragmentos más parecidos a la pregunta, siempre de un solo
-- cliente. `p_min_similarity` corta el ruido: sin él, una pregunta sin
-- respuesta en la base devuelve igualmente los 5 trozos "menos malos" y el
-- modelo los usa como si fueran buenos.
create or replace function match_knowledge(
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
  similarity float
)
language sql stable
as $$
  select
    kc.content,
    kd.title,
    kd.category,
    kd.source_url,
    1 - (kc.embedding <=> p_embedding) as similarity
  from knowledge_chunks kc
  join knowledge_documents kd on kd.id = kc.document_id
  where kc.client_id = p_client_id
    and 1 - (kc.embedding <=> p_embedding) > p_min_similarity
  order by kc.embedding <=> p_embedding
  limit p_match_count;
$$;
