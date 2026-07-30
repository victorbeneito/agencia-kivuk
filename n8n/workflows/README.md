# Plantillas de workflows de n8n

Los workflows viven aquí en JSON para que estén versionados en git. No contienen
secretos: todas las credenciales se leen en tiempo de ejecución desde variables
de entorno (`$env.SUPABASE_URL`, `$env.SUPABASE_SERVICE_ROLE_KEY`,
`$env.OPENAI_API_KEY`) o desde `client_modules.config` en Supabase, que es lo que
el panel de la agencia escribe por cliente.

| Archivo | Qué es |
| --- | --- |
| `whatsapp-bot.json` | Versión actual: WhatsApp + IA con memoria, disponibilidad real de agenda, Google Calendar y confirmación por email (Resend). |
| `whatsapp-bot-v1-calendar.json` | Copia de seguridad de la primera versión (sin memoria, email ni disponibilidad). |

## Cómo agenda el bot

El bot no puede dar una hora ocupada. Antes de llamar a la IA consulta la
disponibilidad real y le pasa los huecos libres ya calculados; y aunque la IA se
equivoque, el nodo `Comprobar disponibilidad` vuelve a validarlo antes de crear
nada:

```
Extraer mensaje → Buscar cliente → Buscar prompt → Buscar módulo calendar
  → Buscar módulo email → Refrescar token Google → Cargar ocupación (freeBusy)
  → Buscar o crear conversación → Cargar historial → Preparar contexto
  → Llamar a OpenAI → Parsear respuesta IA → Comprobar disponibilidad
  → ¿Cita confirmable?
       sí → Crear evento → Enviar email confirmación → Responder por Whatsapp
       no → ─────────────────────────────────────────→ Responder por Whatsapp
  → Guardar mensajes
```

**Reparto de responsabilidades:** la IA solo *extrae* datos (fecha, hora, email)
y conversa; **no decide la disponibilidad**. Esa decisión es del código, en
`Comprobar disponibilidad`, que también redacta las respuestas de disponibilidad.
Se hizo así porque el modelo llegaba a negar horas que sí estaban libres cuando
el historial contenía rechazos anteriores.

`Comprobar disponibilidad` resuelve en este orden, y el orden importa:

1. ¿Falta fecha u hora? → responde la IA, pidiendo lo que falte.
2. ¿La hora está ocupada? → se dice **ya**, con alternativas. No se piden más datos.
3. ¿Está libre pero falta el email? → se confirma que hay hueco y se pide el email.
4. ¿Libre y con email? → se crea el evento y se envía la confirmación.

El paso 2 va antes que el 3 a propósito: pedirle el email a alguien para una cita
que luego resulta imposible es sacarle datos para nada.

Dos detalles que costaron un par de vueltas:

- **La hora del mensaje manda sobre la de la IA.** Se le ha visto devolver
  `time: null` con la hora escrita delante, e incluso coger la primera opción de
  su propia lista de alternativas (le pides las 12:30 y reserva las 12:15). Por
  eso `Comprobar disponibilidad` extrae la hora del texto del mensaje por
  expresión regular y solo usa la de la IA si el mensaje no lleva ninguna
  (p. ej. "vale, la primera me va bien"). El prompt pide que no falle, pero un
  prompt no es una garantía: la red de seguridad va en el código.
- **Alternativas cercanas.** Cuando la hora está ocupada se ofrece la última que
  cabe *antes* y las siguientes *después* de la pedida. Ofrecer las primeras
  horas del día a quien pide las 12:00 no le sirve de nada.

Los huecos salen de cruzar tres cosas: el **horario de atención** del cliente
(configurado en el panel), las franjas **ocupadas** que devuelve la API freeBusy
de Google, y la hora actual.

Dentro del horario hay dos parámetros distintos que conviene no confundir:

- **duración** — lo que ocupa la cita en la agenda (p. ej. 60 min).
- **paso** — cada cuánto puede *empezar* una cita (p. ej. 15 min).

Con duración 60 y paso 15, si la franja está libre se puede reservar a las 10:15.
La lista que ve la IA va agrupada en rangos (`11:15-13:00`) para que el prompt no
crezca sin control; los valores exactos se guardan aparte para la verificación.

Si el cliente no ha configurado horario se aplica L-V, 09:00-14:00 y 16:00-20:00,
citas de 60 minutos con paso de 15 — los mismos valores por defecto que muestra
el panel (`HORARIO_POR_DEFECTO` en `app/src/app/dashboard/[clientId]/page.tsx`).

## ⚠️ Guardar NO es desplegar

Desde n8n 2.x cada workflow tiene dos versiones: el **borrador** (lo que ves y
editas) y la **publicada** (la que ejecutan los webhooks en producción). Pulsar
*Save* solo toca el borrador: hasta que no pulses **Publish**, los mensajes de
WhatsApp reales siguen ejecutando la versión anterior.

Si cambias algo y "no se nota", esto es lo primero que hay que mirar. Para
comprobarlo desde la base de datos:

```bash
docker exec n8n-postgres-1 psql -U n8n -d n8n -c \
  "select w.\"activeVersionId\", json_array_length(h.nodes) as nodos_publicados \
   from workflow_entity w join workflow_history h on h.\"versionId\" = w.\"activeVersionId\" \
   where w.id = '6evfnfBUlZHCuobt';"
```

## Importar en n8n

⚠️ **"Import from File..." NO reemplaza los nodos: los añade** a los que ya hay
en el lienzo. Si lo usas sobre un workflow existente acabas con todo duplicado y
varios triggers peleándose por la misma ruta de webhook.

Para **actualizar** un workflow existente sin perder la URL del webhook
(si la URL cambia hay que reconfigurar Meta):

1. Abre el workflow en n8n.
2. Clic en el lienzo → `Ctrl+A` → `Supr`. Debe quedar vacío.
3. Abre el JSON en un editor, `Ctrl+A` → `Ctrl+C`.
4. Vuelve al lienzo de n8n y `Ctrl+V`.
5. **Save** y después **Publish** (ver el aviso de arriba: sin Publish no se despliega).

El `path` del webhook (`whatsapp-kivuk`) va dentro del JSON, así que se conserva.

Para **crear** un workflow nuevo desde cero, ahí sí sirve `⋯` → *Import from File...*
sobre un lienzo vacío.

## Variables de entorno que necesita

Se definen en `n8n/.env` (ver `n8n/.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
