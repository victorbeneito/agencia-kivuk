# Plantillas de workflows de n8n

Los workflows viven aquí en JSON para que estén versionados en git. No contienen
secretos: todas las credenciales se leen en tiempo de ejecución desde variables
de entorno (`$env.SUPABASE_URL`, `$env.SUPABASE_SERVICE_ROLE_KEY`,
`$env.OPENAI_API_KEY`) o desde `client_modules.config` en Supabase, que es lo que
el panel de la agencia escribe por cliente.

| Archivo | Qué es |
| --- | --- |
| `whatsapp-bot.json` | Versión actual: WhatsApp + IA con memoria, disponibilidad real de agenda, Google Calendar y confirmación por email (Resend). |
| `agenda-api.json` | API interna de agenda: consultar disponibilidad y reservar. La comparten el bot de WhatsApp y el agente de voz. |
| `voz-vapi.json` | Adaptador entre las tool calls de Vapi (agente de voz) y la Agenda API. |
| `catalogo-ingesta.json` | Recorre el sitemap de la tienda de un cliente y vuelca sus productos en `catalog_products`. |
| `contenido-generar.json` | Elige productos del catálogo, pide los copys a la IA, manda renderizar la pieza y la deja pendiente de aprobación. |
| `whatsapp-bot-v1-calendar.json` | Copia de seguridad de la primera versión (sin memoria, email ni disponibilidad). |

## Agenda API

Un solo sitio donde vive la lógica de agenda, para que cada canal (WhatsApp, voz,
y lo que venga) no tenga su propia copia. Se llama por HTTP:

```
POST /webhook/agenda
{ "client_id": "...", "accion": "disponibilidad", "fecha": "2026-08-04" }   ← fecha opcional
{ "client_id": "...", "accion": "reservar", "fecha": "...", "hora": "12:30",
  "email": "...", "contacto": "34600111222" }
```

Devuelve siempre un `mensaje` ya redactado, listo para leer en voz alta o enviar
por WhatsApp, además de los datos estructurados (`dias`, `alternativas`).

- `disponibilidad` agrupa las horas en rangos (`09:00-10:15, 12:15-13:00`). Con
  paso de 15 minutos son decenas de horas sueltas: impronunciables por teléfono.
- `reservar` comprueba el hueco **antes** de crear nada. Si está ocupado devuelve
  `ok: false` con alternativas cercanas y no toca el calendario.
- Acepta horas en formatos hablados (`12h30`, `12'30`) y las normaliza.

Desde otro workflow de n8n se llama a `http://localhost:5678/webhook/agenda`
(n8n hablando consigo mismo); desde fuera, por la URL pública.

## Un solo motor de agenda

WhatsApp y voz **no tienen cada uno su copia** de la lógica de citas: los dos
llaman a `agenda-api.json`. Si mañana se añade un canal nuevo (Instagram, un
formulario web), llama al mismo sitio y hereda todo: horario del cliente,
detección de solapes, alternativas cercanas, creación del evento y email.

```
WhatsApp ─┐
          ├─→ Agenda API ─→ Google Calendar + Resend
Voz/Vapi ─┘
```

La lógica de cálculo de huecos vive además en un único fichero
(`scratchpad/logica-huecos.js` en el generador), del que se inyecta el mismo
código en los nodos que lo necesitan. Es a propósito: cuando esa lógica estaba
duplicada, cada corrección había que hacerla dos veces y era cuestión de tiempo
que divergieran.

## Canal de voz (Vapi)

`voz-vapi.json` traduce entre Vapi y la Agenda API. Toda la particularidad de
Vapi se queda aquí para que `agenda-api.json` no sepa de qué canal viene la
petición.

```
POST /webhook/voz-vapi
```

Acepta los dos formatos que manda Vapi según el tipo de tool: el JSON plano del
tipo *API Request* y el sobre `{ message: { toolCallList: [...] } }` del custom
tool clásico. Y devuelve las dos formas a la vez (`mensaje` plano + `results`
con el `toolCallId`), porque sobra una u otra pero no estorban.

**`ok` no significa "sí".** Significa "la herramienta ha funcionado". Que una
hora esté ocupada es una consulta correcta con un *no* por respuesta, y viaja
como `ok: true` con `hay_hueco: false`. Cuando esto se devolvía como `ok: false`,
Vapi lo leía como un fallo de la tool y el agente se ponía a improvisar en vez
de leer el mensaje que le habíamos redactado.

| campo | qué dice |
| --- | --- |
| `ok` | La herramienta ha respondido. `false` solo si el cliente no existe o la Agenda API no contesta. |
| `mensaje` | Texto ya redactado, listo para leer en voz alta. |
| `hay_hueco` | Si la hora pedida está libre, o si hay huecos en la consulta de disponibilidad. |
| `reservada` | Si la cita se ha creado. |

Multi-tenancy: el cliente se identifica por el `assistant_id` de Vapi
(`client_modules.config.vapi_assistant_id`), de modo que las mismas tools valen
para todos los clientes. Como en las pruebas por web Vapi **no interpolaba** las
plantillas Liquid (`{{ assistant.id }}` llegaba literal), el nodo `Leer tool
call` descarta cualquier valor que contenga `{{` y se admite además un
`client_id` explícito como *static body field*.

El email es opcional en voz: el speech-to-text destroza las direcciones incluso
deletreadas. La cita se crea igual y queda pendiente decidir el canal de
confirmación (SMS o WhatsApp).

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

## Ingesta de catálogo

```
POST /webhook/catalogo
{ "client_id": "...", "limite": 10 }   ← limite opcional, para probar
```

Lee `catalog_sitemap_url` del módulo `social` del cliente, descarga el
sitemap y recorre las fichas de diez en diez con una pausa de un segundo entre
lotes. Contesta enseguida (`Aceptado`) porque recorrer cientos de fichas tarda
minutos y quien llama no debe quedarse esperando.

**Cómo sabe qué es un producto.** No hay selectores de HTML de ninguna tienda:
una página es un producto si se declara como `Product` de schema.org en su
JSON-LD. Lo hacen PrestaShop, WooCommerce y Shopify de serie, así que el mismo
workflow vale para el siguiente cliente sin tocarlo. Lo que no es producto se
descarta solo.

**El filtro de URLs va vacío por defecto, y es a propósito.** Filtrar el sitemap
por patrón parece la optimización obvia hasta que la pruebas: en una tienda real
con 694 URLs, `/productos/\d+` dejaba fuera 109 productos porque su ficha no
lleva ID numérico (`/productos/duo-funda-nordica-franela-valeria`). Descargar
109 páginas de más no cuesta nada; perder 109 productos en silencio, sí.

**Las fotos hay que pedirlas grandes.** El JSON-LD suele apuntar al thumbnail
(`-home_default.jpg`, 250 px). El nodo lo reescribe a `-large_default.jpg` antes
de guardar, porque a 250 px no se puede publicar nada.

## Generación de contenido

```
POST /webhook/contenido
{ "client_id": "...", "cantidad": 9, "formato": "post", "tema": "infantil" }
```

Deja las piezas en `content_items` con estado `pending`. **No publica nada**: eso
lo decide una persona en la pestaña de Contenido del panel.

**Los productos los elige el código, no la IA.** Al principio se le pasaba una
muestra y se le pedía «elige los más variados». Con un catálogo que es 84%
estores, esquivaba justamente la familia dominante por ser la más repetida, y
salían lotes con 2 estores y 7 de ropa de cama: publicando lo que menos se vende.
Ahora el reparto sale de `producto_estrella` y `peso_estrella` del panel, que es
del cliente porque es él quien sabe qué le conviene mover.

Dentro de la familia dominante, la variedad la da el **tema** —zen, paisajes,
infantil, ciudades—, que se detecta solo: es la palabra menos frecuente del
nombre que aun así se repite lo bastante como para no ser ruido. Sin listas
escritas a mano, así que una categoría nueva entra sin tocar código.

**La IA solo redacta**, y aun así se comprueba lo que devuelve:

| comprobación | por qué |
| --- | --- |
| el nombre del producto debe cuadrar con el índice | escribió sobre sábanas de algodón encima de la foto de un estor |
| el tipo de producto debe compartir palabra con el nombre | una etiqueta equivocada («Cojín» sobre un estor) es peor que ninguna |
| hashtags recogidos también del texto | los metía en la caption aunque se le pidiera el campo aparte |
| materiales que no están en el nombre | etiquetó `#algodón` unas sábanas que solo dicen «satén» |
| frases copiadas de los ejemplos del prompt | copió literalmente la frase de muestra del tono, dos lotes seguidos |
| «este/esta» + producto | prohibido al inicio, se mudó a la segunda frase |
| muletillas («ideal para», «un toque especial») | son las que delatan un texto automático |

El nombre y el tipo **corrigen o descartan** la pieza; el resto solo la marca con
un aviso que se ve al aprobarla. Tirar un texto entero por una muletilla sería
tirar trabajo bueno; publicarlo sin que nadie lo mire, peor.

Dos detalles de esas comprobaciones que costaron un rato:

- **Por palabra entera, no por subcadena.** Buscar «lana» con `includes()`
  saltaba dentro de «plana» y avisaba de un material que nadie había mencionado.
  Un aviso falso es peor que ninguno: enseña a ignorarlos.
- **Los ejemplos del prompt hablan de productos que el cliente NO vende.** Con
  ejemplos sobre ventanas, el modelo copiaba la frase tal cual en las piezas de
  estores. Pedirle «no copies» no bastó dos veces seguidas; cambiar el ejemplo a
  una lámpara sí.

**Límite conocido:** «este/esta» + producto se le sigue colando en unas dos de
cada tres piezas pese a la prohibición. Se marca con aviso y se corrige a mano
al aprobar; no compensa otra llamada al modelo solo para eso.

## Cada pieza dice qué se vende

Cada imagen lleva una etiqueta con el tipo de producto arriba a la izquierda
(`Estor enrollable`, `Funda nórdica`). No es decoración: el estilo «a sangre»
recorta el estampado a pantalla completa y el resultado parece un cuadro, no un
estor a medida. Quien lo ve puede darle a me gusta sin enterarse de qué se
vende, y el hashtag no lo salva porque casi nadie los lee.

## ⚠️ Desplegar sin navegador

`scratchpad/desplegar.js` escribe el borrador **y publica**, sin tocar n8n:

```bash
node desplegar.js ../n8n/workflows/contenido-generar.json "Contenido - Generar"
```

Existe porque escribir solo el borrador y pedir un Save+Publish manual falló
tres veces: si la pestaña del navegador estaba abierta de antes, al guardar
mandaba **su** copia vieja encima de la nueva, y el fallo solo se descubría al
ver resultados que no cuadraban.

Publicar es crear una fila en `workflow_history` con un `versionId` nuevo y
apuntar `workflow_entity.activeVersionId` a ella. El orden importa: hay una clave
ajena, así que el historial va primero. Después hace falta reiniciar el
contenedor, porque n8n registra los webhooks de las versiones publicadas al
arrancar.

⚠️ **`/healthz` responde antes de que los webhooks estén registrados.** Lanzar
una llamada justo después del reinicio devuelve `Cannot POST /webhook/...` y
parece que el workflow se ha roto. Hay que darle unos segundos más.

## ⚠️ El nodo Code no es Node.js del todo

La sandbox del nodo Code **no expone todos los globales de Node**. `new URL()`
es el caso que ya nos ha mordido: funciona en cualquier script de prueba y en
n8n lanza excepción. Como estaba dentro de un `try/catch` que devolvía cadena
vacía, no hubo error por ningún lado — simplemente todas las imágenes del
catálogo se guardaron vacías.

Dos consecuencias, y las dos importan:

- **Resolver URLs relativas a mano**, con manipulación de cadenas, sin `URL`.
- **No envolver en `try/catch` silencioso** lo que no puede fallar en
  condiciones normales. Un `catch` que devuelve un valor por defecto convierte
  un error ruidoso en un dato malo y callado, que es mucho peor de encontrar.

Los simuladores de `scratchpad/` ocultan a propósito `URL`, `fetch`, `require`,
`process` y `Buffer` al ejecutar el código de los nodos, para que una prueba que
pasa en local no pueda fallar luego en n8n.

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
