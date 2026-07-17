# Agencia Kivuk — Plataforma IA para agencias (tipo GoHighLevel)

Este archivo es el contexto que debe leer Claude Code (o cualquier agente) al abrir este repositorio. Léelo antes de tocar código.

## Qué es este proyecto

Plataforma multi-cliente para una agencia digital: cada cliente final puede tener activados uno o varios módulos (WhatsApp con IA, agente de voz, agenda/calendar, automatización de correos, marketing e Instagram). El objetivo es reutilizar la misma base de código y las mismas plantillas de automatización para todos los clientes, no construir una app distinta por cliente.

## Arquitectura

- **`/app`** — Next.js (App Router, TypeScript, Tailwind). Panel de control: login de agencia, alta de clientes, activación de módulos por cliente, configuración de bots (prompt, base de conocimiento), visualización de conversaciones/citas/leads.
- **`/n8n`** — n8n self-hosted vía Docker. Es el motor de ejecución: workflows/plantillas reutilizables (WhatsApp, Calendar+Email, Voz, Instagram) que se activan por cliente. Next.js y n8n se comunican por webhooks HTTP.
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
- Toda tabla de Supabase que contenga datos de clientes debe llevar RLS activado desde el primer commit que la crea.
- Las claves de API (OpenRouter, OpenAI, Meta WhatsApp, Twilio, Stripe...) nunca se hardcodean: van en variables de entorno (`.env.local` en `/app`, `.env` en `/n8n`, ambos con su `.example` versionado y el real en `.gitignore`).
- El plan de trabajo avanza por fases (ver `docs/plan-agencia-ia.md`). No adelantar fases sin terminar la anterior salvo indicación explícita.

## Cómo correr el proyecto en local

1. `/app`: `npm install` y `npm run dev` (Next.js en `localhost:3000`).
2. `/n8n`: `docker compose up -d` (n8n en `localhost:5678`).
3. Para probar webhooks reales (WhatsApp, etc.) contra el n8n local, usar ngrok apuntando al puerto 5678.

## Estado actual

Fase 0 en construcción: base multi-tenant (Next.js + Supabase) y n8n local con Docker. Ver tareas y progreso en `docs/plan-agencia-ia.md`.
