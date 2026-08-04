# Traspaso: bot de WhatsApp para un cliente real

Documento de arranque para una sesión nueva de Claude Code. Resume qué hay
construido del módulo de WhatsApp, por qué está hecho así, y qué falta para
pasar de un cliente de prueba a uno que paga.

**Léelo junto a `CLAUDE.md` (raíz) y `n8n/workflows/README.md`.** Aquí no se
repite lo que ya está ahí; se señala lo que hay que mirar y lo que está
desactualizado.

> Escrito el 03/08/2026. Lo que se dice de la API de Meta está verificado contra
> su documentación en esa fecha; Meta cambia estas cosas a menudo, así que
> **vuelve a comprobarlo antes de dar por bueno cualquier dato de aquí**.

---

## 1. Qué hay construido

Un bot multi-cliente de WhatsApp con IA, memoria de conversación y reserva de
citas contra Google Calendar. Funciona hoy con un cliente de prueba.

```
WhatsApp (Meta Cloud API)
        │  webhook
        ▼
  n8n: whatsapp-bot.json  ──►  OpenAI (gpt-4o)
        │                       (extrae datos y conversa)
        ├──►  Agenda API  ──►  Google Calendar + Resend
        │     (decide disponibilidad y reserva)
        └──►  Supabase (conversations, messages, client_modules, agent_configs)
```

### Un solo webhook para todos los clientes

Esto es lo más importante del diseño y conviene no romperlo.

La ruta del webhook es **fija**: `/webhook/whatsapp-kivuk`. No hay una por
cliente. Al llegar un mensaje, el bot lee el `phone_number_id` que manda Meta y
busca a quién pertenece:

```
GET /rest/v1/client_modules?module=eq.whatsapp
    &config->>phone_number_id=eq.{{ phone_number_id }}
    &select=client_id,config
```

De ahí salen el `client_id` y las credenciales de ese cliente. **Dar de alta un
cliente nuevo no toca ningún workflow**: se rellenan sus datos en el panel y ya
recibe mensajes. Es la diferencia entre una plataforma y un montón de bots
copiados.

### Recorrido del workflow (22 nodos)

```
Webhook GET  → If (hub.verify_token) → responde hub.challenge  ← alta en Meta
Webhook POST → Extraer mensaje
             → Buscar cliente Whatsapp     (por phone_number_id)
             → Buscar prompt del cliente   (agent_configs)
             → Consultar agenda            (Agenda API: disponibilidad)
             → Buscar o crear conversación
             → Cargar historial
             → Preparar contexto
             → Llamar a OpenAI             (gpt-4o, response_format json_object)
             → Parsear respuesta IA
             → Decidir acción
             → ¿Consultar agenda? ─┬─ sí → Comprobar o reservar → Respuesta con agenda
                                   └─ no ──────────────────────→ Respuesta sin agenda
             → Respuesta final
             → Responder por Whatsapp      (Graph API)
             → Guardar mensajes
```

### Dónde vive cada cosa

| Qué | Dónde |
| --- | --- |
| Credenciales del cliente | `client_modules.config` (módulo `whatsapp`) |
| Prompt y base de conocimiento | `agent_configs` |
| Historial | `conversations` + `messages` |
| Horario de atención | `client_modules.config` (módulo `calendar`) |
| Claves de servidor | `n8n/.env` — nunca en el JSON |

El panel escribe la config de WhatsApp en
`app/src/app/dashboard/[clientId]/actions.ts` → `updateWhatsappConfig`, con tres
campos: `phone_number_id`, `whatsapp_business_account_id`, `access_token`.

---

## 2. Decisiones que conviene no deshacer

**La IA extrae; el código decide.** El modelo lee el mensaje y saca fecha, hora
y email. **No decide si hay hueco.** Eso lo resuelve la Agenda API contra el
calendario real. Se hizo así porque el modelo llegaba a negar horas libres
cuando el historial tenía rechazos anteriores. Un prompt no es una garantía.

**La hora del mensaje manda sobre la de la IA.** Se le ha visto devolver
`time: null` con la hora escrita delante, y coger la primera opción de su propia
lista de alternativas (le pides las 12:30 y reserva las 12:15). El código extrae
la hora del texto por expresión regular y solo usa la de la IA si el mensaje no
lleva ninguna.

**La lógica de agenda vive en un solo sitio.** WhatsApp y el agente de voz
llaman los dos a `agenda-api.json`. Cuando estaba duplicada, cada corrección
había que hacerla dos veces. Si añades un canal, que llame ahí.

**Nada de código específico por cliente.** Todo lo que cambia entre clientes es
configuración en Supabase.

---

## 3. Lo que hay que arreglar antes de un cliente real

Por orden de importancia.

> **Actualización 04/08/2026.** Los puntos 3.1 y 3.2 ya están resueltos. Se
> dejan escritos porque explican por qué está hecho así y qué falta rematar
> (rotar el token, que sigue en el historial de git).

### 3.1 El token de verificación está escrito en el JSON versionado ✅ resuelto

En el nodo `If` de `whatsapp-bot.json`:

```
"rightValue": "kivuk-secreto-2026"
```

Está en git. Contradice la regla de `CLAUDE.md` de que ninguna clave se
hardcodea. **Hay que moverlo a `$env.META_VERIFY_TOKEN`** antes de dar de alta
un webhook de un cliente que paga.

Además, siendo un único webhook para todos los clientes, el token de
verificación es global. Con un cliente propio da igual; con varios conviene
pensar si se quiere uno por cliente (lo que obligaría a otra ruta) o se asume
que el `phone_number_id` ya identifica el origen.

**Cómo quedó.** El nodo `If` compara contra `$env.META_VERIFY_TOKEN` y la
variable vive en `n8n/.env`. Comprobado: con el token bueno devuelve el
`hub.challenge` (200), con uno falso responde `Forbidden` (403).

Cuidado con dónde se declaran las variables: `docker-compose.yml` las pasa
**una a una**, así que una que esté en `.env` pero no en el bloque `environment`
del servicio **no llega al contenedor**, y `$env.LO_QUE_SEA` vale `undefined`
sin que nada avise. Hubo que añadirla también ahí. (Es la razón de que
`publicar-pieza.json` llevara un `|| 'v25.0'` de respaldo: la variable nunca
había llegado.)

**Queda rotarlo.** El valor sigue siendo `kivuk-secreto-2026`, que estuvo en git
y sigue en su historial. El momento natural para cambiarlo es al dar de alta el
webhook de un cliente nuevo, porque obliga a volver a verificarlo en el panel de
Meta de **cada** app que apunte a esta ruta.

### 3.2 La versión de la Graph API está vieja ✅ resuelto

`Responder por Whatsapp` apuntaba a **v21.0**. En agosto de 2026 la última es la
v26.0 y la v25.0 (febrero de 2026) es la estable con soporte hasta 2028.

**Cómo quedó.** Ahora usa `{{ $env.META_API_VERSION || 'v25.0' }}`, el mismo
patrón de `publicar-pieza.json`, con `META_API_VERSION=v25.0` en el entorno. Se
eligió la estable de soporte largo antes que la última: en un bot que atiende a
clientes reales, ir a la última versión no aporta nada y expone a cambios.

`whatsapp-bot-v1-calendar.json` sigue en v21.0 a propósito: es la copia del
flujo anterior, no está en uso.

### 3.3 Llamadas internas por `localhost:5678`

El bot llama a la Agenda API con `http://localhost:5678/webhook/agenda`. En
local funciona (n8n hablando consigo mismo dentro del contenedor). Al pasar al
VPS hay que revisarlo.

### 3.4 El webhook necesita una URL pública con HTTPS

Meta no acepta `localhost`. En desarrollo, ngrok apuntando al 5678. En
producción, un dominio real con certificado válido — es parte de la Fase 1.5
(VPS) que sigue pendiente.

---

## 4. Lo que Meta exige y no se ve en desarrollo

Esto es lo que separa una demo de un bot que funciona el lunes por la mañana.
**Verificado el 03/08/2026; confírmalo antes de prometer nada al cliente.**

### 4.1 El token del panel caduca en menos de 24 horas

El que se copia del panel de la app **no sirve para producción**. Hace falta un
**token permanente de usuario del sistema**:

> Business Manager → Configuración del negocio → **Usuarios del sistema** →
> Añadir → asignar activos (la app con *Control total*, y la cuenta de WhatsApp
> Business) → **Generar token**

Se muestra **una sola vez**. Va a `client_modules.config.access_token`.

Si el bot funciona hoy y mañana deja de responder sin haber tocado nada, es
esto casi seguro.

### 4.2 Ventana de 24 horas y plantillas

Solo se puede responder libremente **dentro de las 24 h** desde el último
mensaje del cliente final. Fuera de esa ventana hay que usar una **plantilla
aprobada previamente** por Meta.

Un bot que solo responde no lo nota. En cuanto el cliente quiera avisar de algo
—recordar una cita, confirmar un pedido— aparece, y aprobar plantillas lleva su
tiempo. **Pregúntale al cliente si va a querer mensajes iniciados por él antes
de cerrar el alcance.**

### 4.3 Precios — y un cambio en dos meses

Desde julio de 2025 se cobra **por mensaje**, según categoría (marketing,
utilidad, autenticación) y país.

> ⚠️ **Desde el 1 de octubre de 2026**, Meta pasa a cobrar también las
> respuestas de servicio dentro de la ventana de 24 h, que hasta ahora eran
> gratis. Está a dos meses de la fecha de este documento. Si le pasas un
> presupuesto a un cliente, cuéntalo.

Consulta las tarifas de España antes de dar cifras.

### 4.4 Otros trámites

- **Número de teléfono**: no puede estar ya registrado en WhatsApp, o hay que
  migrarlo. Contar con que el cliente quizá use ese número a diario.
- **Verificación del negocio** en Business Manager para producción y para subir
  los límites de envío. Confirma los requisitos actuales.
- **App de Meta**: en este proyecto hay una app `agencia_kivuk` con el caso de
  uso de WhatsApp. Ojo, hay una segunda app `Kivuk Social` **solo para Instagram**
  — no las mezcles, ver `docs/conectar-meta.md`.

---

## 5. Trampas ya aprendidas

Del `n8n/workflows/README.md`, las que aplican aquí:

- **Guardar en n8n NO es desplegar.** n8n 2.x separa borrador y publicado.
- **Cuidado con la pestaña abierta del navegador**: guarda su copia vieja encima
  de la nueva. Ha pasado tres veces. Usa `scratchpad/desplegar.js`.
- **Todo nodo webhook necesita `webhookId` en el JSON.** Sin él, el workflow se
  activa, registra la ruta, y al llegar la primera petición responde `Cannot read
  properties of undefined (reading 'node')`. Al importar desde la interfaz n8n lo
  inventa, así que el fallo solo aparece desplegando el JSON directamente.
- **«Borrar» en la interfaz de n8n es archivar.** El workflow sigue en la tabla
  con el mismo nombre.
- **El nodo Code no es Node.js del todo**: no expone `URL`, `fetch`, `require`,
  `process` ni `Buffer`. Un `new URL()` falla en silencio.
- **`/healthz` responde antes de que los webhooks estén registrados** tras un
  reinicio. Espera a que el webhook conteste de verdad.

---

## 6. Por dónde empezar a leer

En este orden:

1. `CLAUDE.md` — el proyecto y sus reglas.
2. `n8n/workflows/README.md` — secciones «Agenda API», «Un solo motor de agenda»
   y «Cómo agenda el bot».
3. `n8n/workflows/whatsapp-bot.json` — el bot.
4. `n8n/workflows/agenda-api.json` — la lógica de citas.
5. `supabase/migrations/0001_init.sql` — `client_modules`, `agent_configs`,
   `conversations`, `messages` y sus políticas RLS.
6. `app/src/app/dashboard/[clientId]/configuracion/page.tsx` — el formulario.

La sección «Cómo agenda el bot» del README describía un flujo anterior, en el
que el bot hablaba directamente con Google Calendar. Se corrigió el 03/08/2026
al escribir este documento: ahora refleja que esa parte vive dentro de la Agenda
API.

---

## 7. Qué NO tocar

El módulo de contenido y redes sociales (Fase 4) está a medias en otra
conversación:

```
n8n/workflows/catalogo-ingesta.json
n8n/workflows/contenido-generar.json
n8n/workflows/publicar-pieza.json
render/
app/src/app/dashboard/[clientId]/contenido/
supabase/migrations/0003, 0004, 0005
```

Comparten `client_modules` y el panel, así que se pueden rozar. Si hay que
cambiar algo común (`mergeModuleConfig`, el layout del cliente, la barra
lateral), hazlo sin romper lo de contenido.

---

## 8. Primeras preguntas al cliente

Antes de tocar código, esto define el alcance:

1. **¿Qué tiene que resolver el bot?** ¿Solo informar, o también reservar citas?
   Si reserva, ya está casi todo hecho; si tiene que consultar stock o pedidos,
   es un conector nuevo.
2. **¿Qué número va a usar?** ¿Está libre de WhatsApp?
3. **¿Va a querer mandar mensajes él** (recordatorios, promociones)? Eso son
   plantillas aprobadas y coste por mensaje.
4. **¿Tiene Google Calendar?** El módulo de agenda va contra Google. Otro
   calendario es trabajo nuevo.
5. **¿Cuándo pasa una conversación a una persona?** No está construido y en un
   negocio real se echa de menos enseguida.
6. **¿Horario de atención?** Va al módulo `calendar`; sin configurar se aplica
   L-V 09:00-14:00 y 16:00-20:00, citas de 60 min con paso de 15.
