-- Módulo de contenido (Fase 4: marketing e Instagram).
--
-- Dos tablas: el catálogo de productos del cliente (materia prima) y las piezas
-- de contenido generadas a partir de él. Nada aquí es específico de una tienda:
-- el catálogo se llena con el conector que corresponda (sitemap, CSV, API de la
-- tienda) y el resto del módulo funciona igual.

-- === Catálogo ===
-- Lo que vende el cliente. Se refresca periódicamente; `last_seen_at` permite
-- detectar productos que han desaparecido de la tienda sin borrar su historial.
create table if not exists catalog_products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  url text not null,
  external_id text,               -- id o referencia en la tienda de origen
  name text not null,
  description text not null default '',
  price numeric(10, 2),
  currency text not null default 'EUR',
  image_url text,
  category text,
  tags text[] not null default '{}',
  available boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- La URL identifica al producto: es lo único estable entre pasadas del
  -- scraper y lo que permite hacer upsert sin duplicar.
  unique (client_id, url)
);

create index if not exists catalog_products_client_idx
  on catalog_products (client_id, available);
create index if not exists catalog_products_category_idx
  on catalog_products (client_id, category);

-- === Piezas de contenido ===
-- Una story, un post, un carrusel o un reel. Pasa por estados hasta publicarse
-- y nunca salta el paso de aprobación: `published` solo se alcanza desde
-- `approved`/`scheduled`.
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  channel text not null default 'instagram'
    check (channel in ('instagram', 'facebook', 'tiktok')),
  format text not null
    check (format in ('post', 'carousel', 'story', 'reel')),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'scheduled',
                      'publishing', 'published', 'failed', 'rejected')),
  caption text not null default '',
  hashtags text[] not null default '{}',
  -- URLs públicas (Supabase Storage). La API de Instagram no acepta subida
  -- directa de bytes: descarga el medio de una URL accesible desde internet.
  media_urls text[] not null default '{}',
  source_product_ids uuid[] not null default '{}',
  scheduled_for timestamptz,
  published_at timestamptz,
  external_post_id text,          -- id del post en la red, para trazabilidad
  error text,                     -- último fallo de publicación, si lo hubo
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- El cron de publicación pregunta siempre por lo mismo: qué toca publicar ya.
create index if not exists content_items_pendientes_idx
  on content_items (client_id, status, scheduled_for);

-- === Row Level Security ===
alter table catalog_products enable row level security;
alter table content_items enable row level security;

create policy "agency or client access to catalog"
  on catalog_products for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

create policy "agency or client access to content"
  on content_items for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );
