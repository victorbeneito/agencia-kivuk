# Agencia Kivuk

Plataforma multi-cliente para agencia digital: chatbots WhatsApp con IA, agentes de voz, gestión de agenda/correo, marketing e Instagram, todo con automatizaciones n8n reutilizables por cliente.

Lee primero `CLAUDE.md` (contexto de arquitectura y convenciones) y `docs/plan-agencia-ia.md` (plan completo por fases).

## Estructura

```
/app        Next.js (panel de control)
/n8n        Docker Compose + plantillas de workflows
/supabase   Migraciones SQL (esquema multi-tenant + RLS)
/docs       Plan del proyecto y decisiones de arquitectura
```

## Primeros pasos (Fase 0)

1. `cd app && npm install`
2. Crear proyecto en supabase.com, copiar `app/.env.local.example` a `app/.env.local` y rellenar claves.
3. Ejecutar `supabase/migrations/0001_init.sql` en el SQL editor de Supabase.
4. `cd n8n && cp .env.example .env` (ajustar claves) y `docker compose up -d`.
5. `cd app && npm run dev` → abrir `localhost:3000`.
6. n8n disponible en `localhost:5678` (usuario/clave definidos en `n8n/.env`).
