# Agencia Kivuk — Plataforma IA para agencias (tipo GoHighLevel)

Este archivo es el contexto que debe leer Claude Code (o cualquier agente) al abrir este repositorio. Léelo antes de tocar código.

## Qué es este proyecto

Plataforma multi-cliente para una agencia digital: cada cliente final puede tener activados uno o varios módulos (WhatsApp con IA, agente de voz, agenda/calendar, automatización de correos, marketing e Instagram). El objetivo es reutilizar la misma base de código y las mismas plantillas de automatización para todos los clientes, no construir una app distinta por cliente.

## Arquitectura

- **`/app`** — Next.js (App Router, TypeScript, Tailwind). **Dos paneles y la web pública sobre la misma base de código**, repartidos por el rol de `user_profiles`: `/dashboard` es el de la agencia (alta de clientes, módulos, credenciales, prompt, conocimiento, contenido) y `/panel` el del cliente final (solo sus módulos contratados: bandeja de WhatsApp y contenido). Detalle en `docs/panel-cliente-siguientes-pasos.md`. La raíz `/` es la web corporativa (grupo de rutas `(web)`, `docs/web-corporativa.md`); el reparto por rol al iniciar sesión vive en `/entrar`, no en `/`.
- **`/n8n`** — n8n self-hosted vía Docker. Es el motor de ejecución: workflows/plantillas reutilizables (WhatsApp, Calendar+Email, Voz, Instagram) que se activan por cliente. Next.js y n8n se comunican por webhooks HTTP. **En producción vive en el VPS**, no en local: `https://n8n.agenciakivuk.com`.
- **`/supabase`** — Esquema de base de datos (Postgres) y migraciones. Supabase también da Auth y Row Level Security (RLS) para aislar datos entre clientes.
- **`/docs`** — Plan completo del proyecto por fases (`plan-agencia-ia.md`) y decisiones de arquitectura (`architecture.md`). Consulta estos archivos antes de proponer cambios de stack.

## Stack y decisiones (no cambiar sin motivo)

- **Base de datos / Auth:** Supabase (Postgres + Auth + RLS). Multi-tenant real vía RLS por `agency_id` / `client_id`.
- **LLM:** OpenRouter como gateway por defecto (flexibilidad de modelo y coste por cliente). OpenAI directo solo cuando se necesite una API específica no disponible en OpenRouter (ej. Realtime API para voz).
- **Automatizaciones:** n8n self-hosted en Docker (local para desarrollo, VPS para producción). No se construye un motor de automatizaciones propio.
- **Hosting app:** Vercel en desarrollo/fases iniciales (free tier, DX rápida). Migración a Dokploy sobre el mismo VPS de n8n cuando haya clientes de pago, para consolidar coste y control en un solo servidor.
- **Detalle completo de por qué:** ver `docs/architecture.md`.

## Convenciones de trabajo

- Cada módulo (WhatsApp, Voz, Calendar, Email, Instagram) es una plantilla de workflow n8n reutilizable + su correspondiente UI de configuración en Next.js. No se crea código específico por cliente.
- Toda tabla de Supabase que contenga datos de clientes debe llevar RLS activado desde el primer commit que la crea. Las políticas se escriben con `es_agencia_del_cliente()` / `es_usuario_del_cliente()` (migración 0008), no con el subselect copiado a mano.
- **Regla del `client_user`: lee, no escribe.** El cliente final tiene RLS de solo lectura sobre sus datos y ninguna sobre credenciales, prompt, conocimiento ni catálogo. Lo que sí puede hacer pasa por server actions con `service_role` que comprueban permisos y validan la transición. Si una tabla nueva va a verse desde `/panel`, la política por defecto es SELECT y nada más.
- Las claves de API (OpenRouter, OpenAI, Meta WhatsApp, Twilio, Stripe...) nunca se hardcodean: van en variables de entorno (`.env.local` en `/app`, `.env` en `/n8n`, ambos con su `.example` versionado y el real en `.gitignore`).
- El plan de trabajo avanza por fases (ver `docs/plan-agencia-ia.md`). No adelantar fases sin terminar la anterior salvo indicación explícita.

## Dónde corre cada cosa

**n8n vive en el VPS (Contabo, Ubuntu 24.04) desde la Fase 1.5.** El n8n local
está apagado y ngrok ya no se usa: Meta entrega los webhooks directamente al
dominio. Si levantas el n8n local con los mismos workflows, ten cuidado — dos
instancias escribiendo en la misma base de datos de Supabase hacen que parezca
que todo funciona aunque los mensajes los esté procesando la otra.

| Pieza | Dónde | URL |
| --- | --- | --- |
| n8n + render + Caddy | VPS Contabo | `https://n8n.agenciakivuk.com` |
| Panel Next.js | local / Vercel | `localhost:3000` |
| Web corporativa | el mismo despliegue del panel | `https://agenciakivuk.com` |
| Datos, Auth, Storage | Supabase gestionado | — |

Operar el servidor (`ssh kivuk@<IP>`, luego `cd ~/agencia-kivuk/n8n`):

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
dc ps                  # estado de los 4 servicios
dc logs -f n8n         # logs en vivo
git pull && dc up -d --build   # desplegar cambios del repo
```

El `--build` es necesario porque `render` se construye desde el código. Los
secretos viven **solo** en el `.env` del servidor (`chmod 600`), nunca en git.

Para desarrollo local del panel: `/app` → `npm install` y `npm run dev`.

## Estado actual

Fase 1.5 completada: n8n en producción 24/7 con HTTPS, WhatsApp funcionando
contra un cliente real de pruebas (mensajes, citas en Google Calendar y correos
de confirmación verificados).

Panel de administración construido, y sobre él el **panel del cliente**: acceso
propio en `/panel`, secciones según los módulos contratados, bandeja de
conversaciones tipo WhatsApp con relevo humano (una persona entra en el chat y el
bot se calla) y revisión de contenido.

**El panel del cliente está en producción** en `https://panel.agenciakivuk.com`,
con migraciones `0008`–`0011` aplicadas y probado de punta a punta: relevo
humano, envío manual por WhatsApp y los tres canales de aviso de «pide una
persona» (en pantalla, correo por Resend con `agenciakivuk.com` verificado, y
notificación push al móvil).

Es además una PWA instalable, pensada para usarse desde el móvil como si fuera
WhatsApp. Cómo funciona cada pieza y por qué está decidida así:
`docs/panel-cliente-siguientes-pasos.md`.

**Facturación** (migración `0013`): datos fiscales de la agencia y de cada
cliente, catálogo de servicios y tarifas, servicios contratados, generación de
las facturas del periodo, numeración correlativa que reparte la base de datos,
PDF con `pdf-lib` y envío por correo con el adjunto. El cliente ve las suyas en
`/panel/facturas`. Detalle y decisiones: `docs/facturacion.md`. Falta el cobro
automático con Stripe.

**Web corporativa** (`docs/web-corporativa.md`): la landing de `agenciakivuk.com`
vive en la misma aplicación, en el grupo de rutas `(web)`. Una sola página con
una sola acción —abrir conversación—, más aviso legal y privacidad. El botón
principal abrirá el WhatsApp de la agencia en cuanto exista
(`NEXT_PUBLIC_KIVUK_WHATSAPP`); mientras tanto cae al formulario de contacto, que
manda un correo por Resend. Antes de publicarla faltan los datos fiscales del
titular en `app/src/lib/web/kivuk.ts` y el DNS del dominio.

Lo siguiente es el marketing —campañas, captación y un CRM de leads— y está
razonado en `docs/marketing-y-captacion.md`.

Ver tareas y progreso general en `docs/plan-agencia-ia.md`.
