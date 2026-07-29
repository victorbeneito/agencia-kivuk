# Panel de administración — Contexto y plan de trabajo

Este documento es para que lo abras en VS Code con Claude Code y empecéis a construir el panel de administración desde donde lo dejamos. Contiene todo el contexto necesario: qué existe ya, cómo está montado, y qué toca construir a continuación, en orden.

Antes de nada, Claude Code debe leer también `CLAUDE.md` (raíz del proyecto) y `docs/architecture.md` — ahí están las decisiones de stack y convenciones que no hay que romper.

## Estado actual del proyecto

- **Fase 0 (completa):** Next.js + Supabase montados, esquema multi-tenant con RLS aplicado, n8n corriendo en Docker local con `docker-compose.yml`.
- **Fase 1 (completa):** Agente de WhatsApp con IA funcionando de extremo a extremo:
  - Workflow en n8n: recibe mensaje de WhatsApp (Meta Cloud API) → busca el cliente por `phone_number_id` en Supabase → busca su `system_prompt` en `agent_configs` → llama a OpenAI → responde por WhatsApp → guarda la conversación y los mensajes en Supabase.
  - Panel básico en Next.js (`/dashboard` y `/dashboard/[clientId]`) que permite editar el prompt del bot de un cliente sin tocar SQL. **Usa la `service_role key` directamente, sin login todavía** — es un punto pendiente y el primer paso de este documento.
  - Token de WhatsApp: ya es un token permanente (System User de Meta Business), no caduca.

## Arquitectura (resumen)

- **Next.js (App Router, TypeScript, Tailwind)** en `/app` — panel de control.
- **n8n (Docker, local)** en `/n8n` — motor de automatizaciones, plantillas de workflow reutilizables por módulo.
- **Supabase** — Postgres + Auth + RLS, multi-tenant por `agency_id` / `client_id`.
- **OpenAI** (de momento directo, migrable a OpenRouter más adelante) para la IA conversacional.
- Detalle completo de por qué cada elección: `docs/architecture.md`.

## Esquema de Supabase actual

Tablas (todas con RLS activado, ver `supabase/migrations/0001_init.sql`):

- `agencies` (id, name, owner_user_id)
- `clients` (id, agency_id, name)
- `user_profiles` (id → auth.users, agency_id, client_id, role: `agency_admin` | `client_user`)
- `client_modules` (id, client_id, module: whatsapp/voice/calendar/email/instagram, active, config jsonb)
- `agent_configs` (id, client_id, name, system_prompt, knowledge_base)
- `conversations` (id, client_id, channel, external_contact_id) — con restricción única en (client_id, channel, external_contact_id)
- `messages` (id, conversation_id, role, content)

## Estructura del proyecto

```
/app
  /src
    /app
      /dashboard
        page.tsx              → lista de clientes
        /[clientId]
          page.tsx             → editar prompt del bot
          actions.ts           → server action para guardar
      /test-supabase           → página de prueba de conexión (se puede borrar ya)
    /lib
      /supabase
        client.ts               → cliente Supabase para navegador (anon key)
        server.ts                → cliente Supabase para servidor (con cookies) + cliente service_role
/n8n
  docker-compose.yml
  /workflows                    → (pendiente: exportar aquí el workflow de WhatsApp como JSON de respaldo)
/supabase
  /migrations
    0001_init.sql
  seed-test-client.sql
/docs
  plan-agencia-ia.md            → plan completo por fases
  architecture.md                → decisiones de stack
  panel-admin-siguientes-pasos.md → este documento
```

## Plan de trabajo del panel de administración

Construir en este orden — cada paso depende del anterior, no saltar:

### Paso 1 — Login real con Supabase Auth (empezar por aquí)

Ahora mismo cualquiera con la URL de `/dashboard` puede entrar y editar prompts, porque usamos la `service_role key` sin comprobar quién eres. Hay que arreglarlo antes de añadir más pantallas.

Qué construir:
- Página `/login` con formulario de email + contraseña (usar `supabase.auth.signInWithPassword` con el cliente de navegador de `lib/supabase/client.ts`).
- Middleware de Next.js (`middleware.ts` en la raíz de `/app` o `/src`) que compruebe la sesión de Supabase y redirija a `/login` si no hay usuario autenticado, para cualquier ruta bajo `/dashboard`.
- Botón de logout (`supabase.auth.signOut()`).
- Cambiar las páginas del dashboard para que usen el cliente de servidor normal (`createClient` de `server.ts`, que respeta RLS con la sesión del usuario) en vez de `createServiceRoleClient`, apoyándose en las políticas RLS ya creadas (un `agency_admin` ya puede ver sus propios clientes gracias a las políticas de `0001_init.sql`).
- El usuario de prueba ya existe en Supabase Auth (el que creaste en la Fase 1 para el seed de datos) — usa ese mismo para probar el login.

Criterio de aceptación: si no has iniciado sesión, `/dashboard` te manda a `/login`. Si inicias sesión con el usuario de prueba, ves tus clientes (solo los de tu agencia, gracias a RLS).

### Paso 2 — Estructura visual tipo GoHighLevel

- Instalar **shadcn/ui** (`npx shadcn@latest init`, ya compatible con el Tailwind que tiene el proyecto) para tener componentes con buen aspecto sin diseñar desde cero (botones, tablas, formularios, sidebar).
- Layout general: barra lateral fija con navegación (Clientes, Conversaciones, Configuración de la agencia) + cabecera con nombre de la agencia y botón de logout.
- Aplicar ese layout a `/dashboard` y sus subpáginas.

### Paso 3 — Gestión de clientes sin SQL manual

- Formulario para **crear cliente nuevo** (nombre) desde el panel, con su server action correspondiente.
- Dentro de la ficha de cada cliente, una sección para **activar/desactivar módulos** (toggle por módulo: whatsapp, voice, calendar, email, instagram) que escriba en `client_modules`.
- Para el módulo WhatsApp: formulario para meter `phone_number_id`, `whatsapp_business_account_id` y `access_token` desde la UI (en vez del INSERT SQL manual que hicimos en `seed-test-client.sql`).

### Paso 4 — Visor de conversaciones

- Página `/dashboard/[clientId]/conversaciones` que liste las conversaciones de ese cliente (tabla `conversations`).
- Al entrar en una conversación, mostrar el hilo de mensajes (tabla `messages`, ordenados por `created_at`), estilo chat.

### Paso 5 — Pulido y branding (más adelante, no urgente)

- Nombre/logo de la agencia visible en el panel.
- Mejoras de UX según se vaya usando con clientes reales.

## Notas para Claude Code

- Sigue las convenciones de `CLAUDE.md`: nunca hardcodear claves de API, todo en variables de entorno.
- El proyecto usa Server Actions de Next.js (`"use server"`), no hace falta crear API routes separadas salvo que sea necesario para algo que no sea un formulario.
- El envío de mensajes de WhatsApp y la IA siguen viviendo en n8n, no en Next.js — el panel solo lee/escribe configuración en Supabase, no reimplementa lógica de negocio que ya está en los workflows.
- Cuando actives RLS de verdad en el Paso 1, comprueba que las políticas de `0001_init.sql` cubren los casos de uso del panel; si falta alguna política, créala en una migración nueva (`0002_...sql`), no modifiques la 0001 ya aplicada.
