-- Cuentas de redes sociales conectadas por cliente (Fase 4-D: publicación).
--
-- Tabla aparte y no un campo más en `client_modules.config` por un motivo de
-- seguridad, no de orden: ese jsonb lo puede leer el propio `client_user` a
-- través de su política RLS, y un token de página de Meta permite publicar en
-- nombre del negocio. La configuración del módulo (qué producto es el estrella,
-- el sitemap del catálogo) es del cliente; el token es de la agencia.

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  platform text not null check (platform in ('instagram', 'facebook')),

  -- Identificador de la cuenta en Meta: el IG User ID (cuenta profesional de
  -- Instagram) o el Page ID (página de Facebook). No es el @usuario: ese cambia
  -- y no sirve para llamar a la API.
  external_id text not null,

  -- Solo para que en el panel se lea "@hogardetusuenos" y no un número de 17
  -- dígitos. Nunca se usa para llamar a la API.
  username text,

  -- Token de página de larga duración. Los tokens de página derivados de un
  -- token de usuario de larga duración no caducan por tiempo, pero sí se
  -- invalidan si cambias la contraseña, revocas permisos o Meta fuerza una
  -- reautenticación: `token_expires_at` nulo significa "sin caducidad conocida",
  -- no "válido para siempre". Por eso existe `last_checked_at`.
  access_token text not null,
  token_expires_at timestamptz,
  last_checked_at timestamptz,

  active boolean not null default true,

  -- Datos auxiliares que Meta devuelve y conviene conservar sin darles columna:
  -- page_id asociado a la cuenta de Instagram, permisos concedidos, etc.
  meta jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un cliente puede tener varias cuentas por plataforma (dos páginas, dos
  -- perfiles), pero no la misma repetida.
  unique (client_id, platform, external_id)
);

create index if not exists social_accounts_activas_idx
  on social_accounts (client_id, platform, active);

-- === Row Level Security ===
alter table social_accounts enable row level security;

-- A diferencia del resto de tablas del proyecto, aquí NO se concede acceso al
-- `client_user`: solo al administrador de la agencia dueña del cliente. Quien
-- tenga esta fila puede publicar en la cuenta.
create policy "only agency admins manage social accounts"
  on social_accounts for all
  using (
    client_id in (
      select c.id from clients c
      join user_profiles up on up.agency_id = c.agency_id
      where up.id = auth.uid() and up.role = 'agency_admin'
    )
  );

-- Nota: n8n usa la service_role key y no pasa por RLS, que es justo lo que se
-- necesita para que el workflow de publicación lea el token. La clave nunca
-- sale del servidor.
