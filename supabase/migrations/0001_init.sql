-- Esquema base multi-tenant. Ejecutar en el SQL editor de Supabase
-- o vía `supabase db push` una vez tengas el proyecto Supabase creado.

-- Agencias (tu empresa, o cada agencia que use la plataforma)
create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

-- Clientes finales de cada agencia (el negocio que recibe los servicios)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete cascade not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- Relación usuario <-> agencia/cliente y su rol
create type user_role as enum ('agency_admin', 'client_user');

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  role user_role not null default 'client_user',
  created_at timestamptz not null default now()
);

-- Qué módulos tiene activos cada cliente (whatsapp, voice, calendar, email, instagram)
create table if not exists client_modules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  module text not null check (module in ('whatsapp', 'voice', 'calendar', 'email', 'instagram')),
  active boolean not null default true,
  config jsonb not null default '{}', -- prompt, api keys específicas del cliente, etc.
  created_at timestamptz not null default now(),
  unique (client_id, module)
);

-- Configuración del/los bots de cada cliente (prompt, base de conocimiento)
create table if not exists agent_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  system_prompt text not null default '',
  knowledge_base text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historial de conversaciones (WhatsApp, voz...) por cliente
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  channel text not null check (channel in ('whatsapp', 'voice', 'other')),
  external_contact_id text, -- número de teléfono u otro identificador externo
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

-- === Row Level Security ===
-- Toda tabla con datos de cliente lleva RLS desde el primer commit.

alter table agencies enable row level security;
alter table clients enable row level security;
alter table user_profiles enable row level security;
alter table client_modules enable row level security;
alter table agent_configs enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Un admin de agencia ve/gestiona su agencia y los clientes de esa agencia.
create policy "agency admins manage own agency"
  on agencies for all
  using (owner_user_id = auth.uid());

create policy "agency admins manage own clients"
  on clients for all
  using (
    agency_id in (
      select agency_id from user_profiles
      where id = auth.uid() and role = 'agency_admin'
    )
  );

-- Los usuarios ven su propio perfil.
create policy "users see own profile"
  on user_profiles for select
  using (id = auth.uid());

-- Módulos, configs, conversaciones y mensajes: visibles si el usuario pertenece
-- a la agencia dueña del cliente, o es el propio client_user de ese cliente.
create policy "agency or client access to modules"
  on client_modules for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

create policy "agency or client access to agent configs"
  on agent_configs for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

create policy "agency or client access to conversations"
  on conversations for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

create policy "agency or client access to messages"
  on messages for all
  using (
    conversation_id in (
      select conv.id from conversations conv
      join clients c on c.id = conv.client_id
      join user_profiles up on up.agency_id = c.agency_id or up.client_id = c.id
      where up.id = auth.uid()
    )
  );

-- Nota: n8n usará la service_role key de Supabase para leer/escribir estas
-- tablas desde los workflows (bypassa RLS por diseño, es tráfico de servidor
-- a servidor, no de usuario final). Nunca expongas la service_role key en el
-- frontend de Next.js, solo en variables de entorno del lado servidor/n8n.
