# Decisiones de arquitectura y stack

Registro de por qué se eligió cada herramienta, para no re-discutirlo en cada fase.

## Arquitectura objetivo

El principio que ordena todo: **lo que no tiene estado va en hardware barato bajo nuestro control; lo que tiene estado y es difícil de operar va gestionado.**

| Dónde | Qué | Si se pierde |
| --- | --- | --- |
| **VPS** (~5 €/mes) | n8n, su Postgres interno, servicio `render`, Caddy y —cuando haya facturación— el panel Next.js | Se vuelve a levantar desde git en una tarde |
| **Supabase gestionado** | Datos de negocio, Auth, Storage, vectores del RAG | No se recupera |

Dominios: `agenciakivuk.com` → panel; `n8n.agenciakivuk.com` → VPS.

La consecuencia práctica: el VPS **no** es un punto único de fallo para los datos. Puede arder entero y los clientes conservan sus conversaciones, catálogos y configuración.

## Base de datos y Auth: Supabase gestionado (no se autoaloja)

Alternativas consideradas: Neon, PlanetScale, Firebase, Postgres pelado en el VPS, Supabase self-hosted.

Se mantiene Supabase gestionado porque da en un solo producto lo que esta plataforma necesita: Postgres, **Auth**, **Row Level Security** (el aislamiento entre clientes, columna vertebral del diseño multi-tenant), **Storage** (piezas renderizadas) y **pgvector** (base de conocimiento).

**Por qué no llevarlo al VPS aunque el panel acabe ahí.** Es la pregunta que surge sola al consolidar servidores, y la respuesta es que panel y base de datos no son el mismo tipo de problema:

- El panel es código sin estado: se mueve en una hora y se revierte sin perder nada.
- La base de datos guarda datos de clientes: migrarla implica downtime, riesgo de pérdida y asumir para siempre su operación.

Las dos vías de autoalojarlo tienen un coste desproporcionado para un equipo de una persona:

- **Postgres pelado**: obliga a implementar la autenticación a mano. Semanas de trabajo reinventando algo que ya funciona, justo en la parte donde un fallo es una brecha de seguridad.
- **Supabase self-hosted**: es oficial y viable, pero son ~10 contenedores (GoTrue, PostgREST, Realtime, Storage, Kong, Studio...) cuyas actualizaciones, backups y recuperación pasan a ser trabajo propio.

Comparación de valor, que es lo que decide: Vercel Pro (20 $/mes) paga por desplegar una app sin estado que se autoaloja en una tarde — compensa poco teniendo ya servidor. Supabase Pro (25 $/mes) paga por backups diarios probados, recuperación a un punto en el tiempo y actualizaciones gestionadas — difícil de replicar bien y caro de hacer mal.

## LLM: OpenRouter como gateway por defecto, OpenAI directo para casos concretos

Alternativas consideradas: solo OpenAI, solo Anthropic.

OpenRouter da acceso a múltiples proveedores (OpenAI, Anthropic, Google, modelos open-source) con una sola API y sin contrato por proveedor. Esto importa porque con varios clientes vas a querer ajustar coste/calidad por caso: un bot de FAQs simple puede usar un modelo barato (Gemini Flash, Llama, DeepSeek), mientras que un caso complejo puede usar GPT-4o o Claude. Cambiar de modelo es cambiar un parámetro, no reescribir integración.

Excepción: OpenAI Realtime API (para el agente de voz) es un producto específico de OpenAI sin equivalente en OpenRouter — para eso se llama a OpenAI directo.

## Automatizaciones: n8n self-hosted (Docker)

Alternativas consideradas: Zapier/Make (de pago por ejecución, caro a escala con muchos clientes), motor de automatizaciones propio (mucho tiempo de desarrollo).

n8n self-hosted es gratis (solo pagas el VPS donde corre), visual, y permite crear plantillas de workflow reutilizables por módulo (WhatsApp, Calendar+Email, Voz, Instagram) que se activan por cliente sin escribir código nuevo cada vez.

## Hosting de la app: Vercel ahora, Dokploy más adelante

Alternativas consideradas: solo Vercel, solo VPS con Dokploy desde el principio.

Fase de desarrollo (Fase 0-1): Vercel, porque el free tier y el flujo de despliegue automático son los más rápidos para iterar sin fricción.

**El disparador de la migración no es técnico, es de licencia.** El plan Hobby de Vercel es solo para proyectos personales sin uso comercial: en cuanto el proyecto genere ingresos o dé servicio a clientes que pagan, sus condiciones obligan a pasar a **Pro (20 $/mes por usuario)**. Por capacidad, Vercel aguantaría indefinidamente — el panel es un dashboard para la agencia y un puñado de clientes, no una web pública de alto tráfico, y dar acceso a cada cliente no cambia eso.

Así que el momento de decidir es concreto: **cuando se facture al primer cliente**. Ahí se elige entre pagar Vercel Pro (240 $/año) o mover el panel al VPS que ya se está pagando. La segunda opción es la prevista: Dokploy (o Coolify) sobre el mismo servidor de n8n — una capa gratuita tipo "Vercel self-hosted" sobre Docker que despliega desde GitHub igual que Vercel. Con 8 GB de RAM sobra sitio, y Docker y Caddy ya están montados: añadir el Next.js es un servicio más en el compose y una entrada más en el Caddyfile. Un único servidor, un único coste fijo, control total.

Convivencia de dominios mientras tanto: `agenciakivuk.com` apunta a Vercel (panel) y `n8n.agenciakivuk.com` a la IP del VPS. Son registros DNS distintos del mismo dominio, no interfieren.

## Dónde se hace el trabajo (herramientas de desarrollo)

- **Este chat (Cowork):** planificación, documentación, investigación, generación de archivos base/scaffolding puntual. No es el sitio para el ciclo de desarrollo día a día (levantar servidores locales, Docker, depurar en el navegador), porque el entorno es una sandbox temporal sin conexión directa a tu máquina.
- **VS Code + Claude Code (CLI o extensión):** el sitio de trabajo principal para programar. Ahí corres `npm run dev`, `docker compose up`, pruebas en el navegador, git, y tienes a Claude Code con contexto de este mismo `CLAUDE.md` para ayudarte a escribir código.
- **Esta carpeta del proyecto** es la fuente de verdad compartida: el código, la documentación y las plantillas de n8n viven aquí, tanto si los tocas desde Cowork como desde VS Code.
