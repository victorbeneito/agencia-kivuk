# Plan: Plataforma tipo GoHighLevel para agencias (WhatsApp + Voz + Instagram + Automatizaciones con n8n)

## Idea general (arquitectura definitiva)

Dos piezas que se reparten el trabajo:

- **Next.js + Supabase** = el panel de control. Login de agencia, gestión de clientes, qué módulos tiene activos cada uno (WhatsApp / Voz / Calendar / Email / Instagram), historial de conversaciones, facturación.
- **n8n (self-hosted, Docker)** = el motor que ejecuta la lógica real de cada cliente: recibe el mensaje de WhatsApp, llama a OpenAI, agenda en Calendar, manda el email, gestiona la llamada de voz. Cada cliente no es "código nuevo", es una **plantilla de workflow** reutilizable que activas y personalizas con sus datos (webhook + variables + API keys del cliente si aplica).

Esto es lo que te permite escalar sin reescribir nada: cliente A solo quiere WhatsApp, cliente B quiere WhatsApp + Calendar, cliente C quiere Voz, cliente D solo automatización de correos — todo son combinaciones de las mismas 4-5 plantillas de n8n, activadas según lo que contrató.

**Comunicación entre piezas:** Next.js y n8n se hablan por webhooks (HTTP). Supabase es la fuente de verdad de "qué workflows tiene activos cada cliente" y guarda los datos (conversaciones, citas, leads).

---

## Local vs VPS: cuándo cada uno

**Local primero, siempre.** Docker funciona igual en tu ordenador que en el VPS (misma configuración, `docker-compose.yml` idéntico), así que:

1. Montas n8n en local con Docker → construyes y pruebas tus primeras plantillas de workflow sin gastar nada ni depender de un servidor.
2. Para probar webhooks reales (WhatsApp, llamadas) desde local, usas **ngrok** (gratis) que te da una URL pública temporal apuntando a tu n8n local.
3. Cuando una plantilla ya funciona bien en local, **despliegas el mismo `docker-compose.yml` al VPS** — es prácticamente copiar y pegar. No se reconstruye nada, solo cambia dónde vive.

**Cuándo necesitas el VPS sí o sí:** en cuanto quieras tener un cliente real usando el WhatsApp bot o el agente de voz de forma continua, porque necesitas una URL pública fija y el servicio corriendo 24/7 (ngrok gratis no es para producción, las URLs cambian). Es decir: local para desarrollar y probar, VPS para el primer cliente real.

---

## Fase 0 — Arquitectura base + n8n en local (2-3 semanas)

**Qué construir:**
- Proyecto Next.js (App Router) + Supabase.
- Tablas base:
  - `agencies`, `clients`, `users` (rol admin agencia / cliente)
  - `client_modules` (qué workflows/n8n tiene activos cada cliente: whatsapp, voz, calendar, email, instagram)
  - `agent_configs` (prompt, personalidad, base de conocimiento por bot)
- Row Level Security (RLS) en Supabase para aislar datos por cliente.
- Auth con Supabase Auth.
- **n8n en Docker, en local:**
  - Instalar Docker Desktop si no lo tienes.
  - Levantar n8n con `docker-compose` (n8n + Postgres para que persista, aunque para pruebas vale hasta con SQLite por defecto).
  - Crear tu primer workflow de prueba: un webhook que recibe un mensaje y responde algo simple, para validar que Next.js puede llamar a n8n y viceversa.
  - Instalar ngrok y exponer tu n8n local para probar un webhook real.

**Herramientas (gratis):** Next.js, Supabase (free), Vercel (free), Docker Desktop (free), n8n self-hosted (free), ngrok (free).

**Entregable:** dashboard vacío con clientes de prueba + n8n corriendo en tu máquina con un workflow de "hola mundo" conectado a Next.js.

---

## Fase 1 — Agente WhatsApp con IA (3-4 semanas)

**Qué construir:**
- Plantilla de workflow en n8n: webhook de WhatsApp → nodo OpenAI (con el prompt/config del cliente, leído desde Supabase) → responder por WhatsApp → guardar conversación en Supabase.
- Conexión WhatsApp: **Meta WhatsApp Cloud API** (oficial, gratis hasta 1000 conversaciones/mes) — recomendado frente a Baileys para algo que vas a vender.
- Panel en Next.js donde el cliente edita: nombre del bot, prompt, base de conocimiento (FAQ, productos). Estos datos los lee n8n desde Supabase en cada ejecución.

**Cuándo pasar a VPS:** aquí es donde toca desplegar n8n al VPS, porque Meta exige una URL de webhook pública y estable para verificar el número.

**Herramientas:** Meta Cloud API (gratis), OpenAI API (pago por uso), n8n en VPS.

**Entregable:** un cliente activa su WhatsApp desde el dashboard, y el workflow de n8n responde con IA usando su configuración.

---

## Fase 1.5 — Desplegar n8n al VPS ✅ COMPLETADA (5 de agosto de 2026)

**Qué se hizo:**
- VPS contratado en **Contabo** (Cloud VPS 4: 4 vCPU, 8 GB RAM, 96 GB, ~4,68 €/mes, Ubuntu 24.04 LTS, UE). Se descartó Hetzner por las subidas de precio de 2026 — ver `docs/fase-1.5-desplegar-vps.md`.
- Servidor asegurado: usuario `kivuk` con sudo, ufw (solo 22/80/443), fail2ban y acceso SSH **solo por clave**.
- Docker + Caddy como proxy inverso con HTTPS automático de Let's Encrypt.
- Dominio `n8n.agenciakivuk.com` (DNS en Hostalia) apuntando al VPS.
- Los 6 workflows importados y publicados; webhooks registrados.
- Meta/WhatsApp reapuntado al dominio nuevo. ngrok y el n8n local, apagados.

**Verificado en producción:** mensaje real de WhatsApp respondido con IA, cita
reservada en Google Calendar con correo de confirmación, datos guardados en
Supabase, y **reinicio completo del servidor con todos los servicios volviendo
solos**.

**Pendiente menor:** reapuntar el webhook de Vapi (agente de voz) cuando se
retome ese módulo, y probar el `render` de contenido de punta a punta.

**Entregable:** n8n corriendo 24/7 en producción, con HTTPS, listo para clientes reales. ✅

---

## Fase 2 — Agenda y correo integrados (2-3 semanas)

**Qué construir:**
- Nueva plantilla/rama de workflow en n8n: el mismo flujo de WhatsApp detecta intención de agendar → nodo de Google Calendar (OAuth por cliente) → crea el evento → nodo de email (Resend o Gmail) → confirma la cita.
- Esto se activa solo para los clientes que tengan el módulo "Calendar" marcado en `client_modules`.

**Herramientas:** Google Calendar API (gratis), Resend (gratis hasta 3000 emails/mes).

**Entregable:** el bot de WhatsApp agenda citas reales y confirma por email, todo orquestado por n8n.

---

## Fase 3 — Agente de voz (3-4 semanas)

Dos etapas:

**Etapa A (rápida, para validar):** usar Vapi o Retell AI (freemium) conectados a n8n vía sus webhooks, para lanzar algo funcional rápido sin construir el pipeline de audio tú mismo.

**Etapa B (control total, más barato a escala):** pipeline propio dentro de n8n: Twilio recibe la llamada → nodo que llama a Whisper/OpenAI Realtime (voz→texto) → GPT (misma lógica de function calling que en WhatsApp: agenda, email) → TTS (voz de vuelta).

**Herramientas:** Twilio (pago por minuto, barato), OpenAI Realtime API, o Vapi/Retell (freemium).

**Entregable:** número de teléfono con IA que agenda citas, mismo backend de Supabase que WhatsApp.

---

## Fase 4 — Marketing e Instagram (3-4 semanas)

**Corrección sobre el plan inicial:** aquí se dijo "DALL-E o Stable Diffusion para
las imágenes". Para un cliente con tienda real es un error: una imagen generada
enseñaría un producto que no vende. Las fotos salen de su **catálogo**, y la IA
se ocupa del texto y de decidir qué se publica. La generación de imagen se
reserva para fondos y elementos gráficos, nunca para el producto.

**Qué construir (por incrementos):**

- **A. Catálogo.** Workflow que recorre el sitemap de la tienda y guarda cada
  producto en `catalog_products`. Reconoce las fichas por su JSON-LD de
  schema.org, así que sirve para PrestaShop, WooCommerce o Shopify sin tocar
  código.
- **B. Generación.** OpenAI escribe copy y hashtags y agrupa productos por tema;
  FFmpeg compone la story (1080×1920), el post (1080×1350) y el reel (15 s) a
  partir de las fotos reales. Coste en imagen: 0 €.
- **C. Aprobación.** Calendario en el panel: el cliente ve lo generado, edita el
  texto y aprueba. Nada se publica sin su OK.
- **D. Publicación.** Cron que publica lo aprobado vía Instagram Graph API.

**Herramientas:** Instagram Graph API (gratis), OpenAI (copys), FFmpeg (gratis),
Supabase Storage (los medios necesitan URL pública: la API de Instagram no
acepta subida directa de bytes).

**Requisitos de cuenta:** Instagram Business o Creator vinculada a una página de
Facebook. Es innegociable para publicar por API.

**Entregable:** el cliente pide un mes de contenido, se genera, se aprueba desde el panel, y n8n lo publica solo en la fecha programada.

---

## Fase 5 — Escalar plantillas + facturación + lanzamiento (4-6 semanas)

**Qué construir:**
- Consolidar las plantillas de n8n como "módulos" claros y documentados (WhatsApp, Calendar, Voz, Email, Instagram) para poder clonar y asignar a un cliente nuevo en minutos.
- Stripe para facturación por agencia/cliente y planes.
- Onboarding: alta de agencia nueva y activación de módulos desde el dashboard sin que tú toques nada a mano.

**Herramientas:** Stripe (sin coste fijo, comisión por venta).

**Entregable:** producto vendible con cobro automático, listo para los primeros clientes reales.

---

## Resumen de costes

Gratis o casi gratis para empezar: Supabase, Vercel, Docker/n8n self-hosted, ngrok, Meta WhatsApp Cloud API, Google Calendar API, Resend, Instagram Graph API, Stripe (sin coste fijo). Costes reales de pago: VPS (~4-5€/mes desde la Fase 1.5), dominio (~10-15€/año), OpenAI (pago por uso), Twilio si llegas a voz (pago por minuto, bajo).

---

## Cómo vamos a trabajar

1. Tú me dices "vamos con la Fase X".
2. Te doy el detalle técnico de esa fase: esquema de Supabase, estructura de carpetas, configuración exacta de Docker/n8n, código de ejemplo.
3. Lo construyes, me traes dudas o errores, iteramos hasta que funcione.
4. Cuando tengas n8n instalado (local o VPS), puedes conectar aquí el conector oficial de n8n para que te ayude directamente a revisar y depurar workflows desde esta conversación.
5. Pasamos a la siguiente fase.

## Próximo paso concreto (esta semana): Fase 0

1. Crear proyecto Next.js + Supabase con el esquema multi-cliente descrito arriba.
2. Instalar Docker Desktop.
3. Levantar n8n local con `docker-compose` y crear un workflow de prueba (webhook → respuesta simple).
4. Probar con ngrok que ese webhook es alcanzable desde fuera.

Cuando quieras arrancar, dime "empecemos la Fase 0" y te doy el esquema de base de datos exacto, la estructura de carpetas de Next.js y el `docker-compose.yml` para levantar n8n.
