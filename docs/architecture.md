# Decisiones de arquitectura y stack

Registro de por qué se eligió cada herramienta, para no re-discutirlo en cada fase.

## Base de datos y Auth: Supabase (se mantiene)

Alternativas consideradas: Neon, PlanetScale, Firebase.

Se mantiene Supabase porque da en un solo producto: Postgres, Auth, Row Level Security (clave para aislar datos entre clientes sin escribir lógica de permisos a mano) y Storage. Es exactamente el patrón que necesita una plataforma multi-tenant, y ya lo conoces de proyectos anteriores.

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

Cuando haya clientes de pago (Fase 1.5 en adelante): migrar a Dokploy corriendo en el mismo VPS que ya tienes para n8n. Dokploy es una capa gratuita tipo "Vercel/Heroku self-hosted" sobre Docker: permite desplegar Next.js, n8n, Postgres, etc. todo en el mismo servidor con una interfaz simple, evitando pagar Vercel Pro más el VPS por separado. Un único servidor, un único coste fijo (~4-5€/mes de VPS), control total.

## Dónde se hace el trabajo (herramientas de desarrollo)

- **Este chat (Cowork):** planificación, documentación, investigación, generación de archivos base/scaffolding puntual. No es el sitio para el ciclo de desarrollo día a día (levantar servidores locales, Docker, depurar en el navegador), porque el entorno es una sandbox temporal sin conexión directa a tu máquina.
- **VS Code + Claude Code (CLI o extensión):** el sitio de trabajo principal para programar. Ahí corres `npm run dev`, `docker compose up`, pruebas en el navegador, git, y tienes a Claude Code con contexto de este mismo `CLAUDE.md` para ayudarte a escribir código.
- **Esta carpeta del proyecto** es la fuente de verdad compartida: el código, la documentación y las plantillas de n8n viven aquí, tanto si los tocas desde Cowork como desde VS Code.
