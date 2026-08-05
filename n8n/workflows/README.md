# Plantillas de workflows de n8n

Los workflows viven aquí en JSON para que estén versionados en git. No contienen
secretos: todas las credenciales se leen en tiempo de ejecución desde variables
de entorno (`$env.SUPABASE_URL`, `$env.SUPABASE_SERVICE_ROLE_KEY`,
`$env.OPENAI_API_KEY`) o desde `client_modules.config` en Supabase, que es lo que
el panel de la agencia escribe por cliente.

| Archivo | Qué es |
| --- | --- |
| `whatsapp-bot.json` | Versión actual: WhatsApp + IA con memoria, disponibilidad real de agenda, Google Calendar y confirmación por email (Resend). |
| `enviar-whatsapp.json` | Envía un mensaje escrito por una persona desde la bandeja del panel. Es el único workflow que llama el panel para hablar con Meta. |
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

## De dónde saca el bot lo que sabe (RAG)

Antes de llamar a la IA, el bot busca en dos sitios lo que haga falta para
**esa** pregunta y se lo pone delante. No se le pasa la base de conocimiento
entera: no cabría, se pagaría en cada mensaje y el modelo se despista.

| Fuente | Qué aporta | Cómo se busca |
| --- | --- | --- |
| `knowledge_documents` / `knowledge_chunks` | Políticas, horarios, cómo funciona el negocio | Búsqueda vectorial (`match_knowledge`) |
| `catalog_products` | Nombre, **precio** y URL de producto | Búsqueda por texto sin tildes (`buscar_productos`) |

**Los precios no salen nunca de un documento escrito a mano.** Cambian, y un
precio inventado o viejo dicho a un comprador real hace daño de verdad. Salen de
`catalog_products`, que se resincroniza con el workflow de ingesta.

**Sin tildes por los dos lados.** `Preparar búsqueda` normaliza la pregunta y
`buscar_productos` aplica `unaccent` en la base. Por WhatsApp casi nadie escribe
«lámpara» con tilde, y sin esto no encontraría *Lámpara colgante de rafia*.

**Las reglas de anclaje son la mitad del trabajo.** Los fragmentos se envían con
instrucciones explícitas de responder solo con eso y de decir que no lo sabe
cuando no esté. Sin ellas el modelo rellena los huecos por su cuenta, que es
exactamente lo que no se quiere en una tienda.

**Los dos nodos de búsqueda llevan «Always Output Data».** Una búsqueda sin
resultados devuelve cero filas, y en n8n cero items **corta el flujo**: el bot se
quedaría mudo justo con el cliente que aún no ha cargado su conocimiento. Con esa
opción llega un item vacío, se filtra, y el bot responde con su prompt normal.

**Dónde se insertan importa.** Van antes de `Cargar historial`, no justo antes de
`Preparar contexto` como podría parecer: ese nodo lee el historial con
`$input.all()`, así que meterle otra cosa por delante lo deja sin memoria de
conversación.

**Se cambió `.item` por `.first()`** en los nodos de aguas abajo. `.item` resuelve
por emparejamiento de items, y los nodos nuevos agrupan varias filas en una, con
lo que ese emparejamiento se pierde. Aquí cada ejecución atiende un solo mensaje,
así que `.first()` es equivalente y no depende de él.

## Un bot que no reserva citas

No todos los clientes tienen agenda: una tienda solo asesora. En vez de duplicar
el workflow, `Preparar búsqueda` mira los módulos activos del cliente y marca
`tiene_agenda`. Con eso:

- `Preparar contexto` no le mete el calendario ni las instrucciones de reserva, y
  usa un juego de instrucciones de atención al cliente.
- `Decidir acción` fuerza `accion = 'ninguna'`, así que nunca llega a la Agenda
  API aunque el modelo devuelva una fecha.

Lo segundo no sobra. Si solo se quita el calendario del prompt, basta con que
alguien escriba «¿me lo mandáis el viernes a las 10?» para que el bot intente
reservar una cita que nadie ha pedido.

`Consultar agenda` se sigue llamando, pero con `onError: continueRegularOutput`:
que la Agenda API no responda para un cliente sin calendario no puede dejar al
bot sin contestar.

## Cómo agenda el bot

El bot no puede dar una hora ocupada. Antes de llamar a la IA consulta la
disponibilidad real y le pasa los huecos libres ya calculados; y aunque la IA se
equivoque, el nodo `Comprobar disponibilidad` vuelve a validarlo antes de crear
nada:

```
Extraer mensaje → Buscar cliente Whatsapp → Buscar prompt del cliente
  → Módulos del cliente → Preparar búsqueda
  → Generar embedding → Buscar conocimiento → Recoger conocimiento
  → Buscar productos → Recoger productos
  → Consultar agenda (Agenda API: disponibilidad)
  → Buscar o crear conversación → Cargar historial → Preparar contexto
  → Llamar a OpenAI → Parsear respuesta IA → Decidir acción
  → ¿Consultar agenda?
       sí → Comprobar o reservar (Agenda API) → Respuesta con agenda
       no → ───────────────────────────────────→ Respuesta sin agenda
  → Respuesta final → Responder por Whatsapp → Guardar mensajes
  → ¿Pide una persona? → Marcar que pide persona
```

Google Calendar y el email **ya no aparecen aquí**: viven dentro de la Agenda
API, y el bot solo la llama. Lo que sigue describe cómo reparte esa API el
trabajo, que es lo que importa entender.

**Reparto de responsabilidades:** la IA solo *extrae* datos (fecha, hora, email)
y conversa; **no decide la disponibilidad**. Esa decisión es del código, dentro
de la Agenda API, que además redacta el mensaje de respuesta ya listo para
enviar. Se hizo así porque el modelo llegaba a negar horas que sí estaban libres
cuando el historial contenía rechazos anteriores.

La Agenda API resuelve en este orden, y el orden importa:

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
una página es un producto si se declara como `Product` de schema.org. Lo hacen
PrestaShop, WooCommerce y Shopify de serie, así que el mismo workflow vale para
el siguiente cliente sin tocarlo. Lo que no es producto se descarta solo.

Se busca de dos formas, en este orden:

1. **JSON-LD** (`<script type="application/ld+json">`), que es lo habitual.
2. **Microdatos** (`itemprop` / `itemtype` en el propio HTML) si no hay JSON-LD
   de producto. Esta segunda vía se añadió por Cestería Aparici, que va con
   **Odoo**: Odoo publica los mismos campos de schema.org como atributos, y solo
   emite JSON-LD de `Organization`. Sin ella el workflow terminaba «bien» con
   cero productos, descartando las 368 fichas una a una sin un solo error.

**Una ficha declara un `Product`; un listado, muchos.** La página
`/shop/category/capazos-54` lleva 16 bloques `Product`, uno por tarjeta. Al leer
microdatos hay que contarlos y descartar la página si no hay exactamente uno, o
la primera tarjeta se guarda como un producto cuya URL es la del listado: basura
que además parece correcta de un vistazo. Con JSON-LD el problema no existe
porque los listados no lo emiten.

**Odoo casi nunca dice la categoría en la ficha.** Solo aparece en la miga de
pan si se llegó navegando desde la categoría, así que al entrar por el sitemap
la mayoría de productos se guardan sin `category`. Es un campo opcional; se deja
vacío antes que inventarlo.

**El filtro de URLs va vacío por defecto, y es a propósito.** Filtrar el sitemap
por patrón parece la optimización obvia hasta que la pruebas: en una tienda real
con 694 URLs, `/productos/\d+` dejaba fuera 109 productos porque su ficha no
lleva ID numérico (`/productos/duo-funda-nordica-franela-valeria`). Descargar
109 páginas de más no cuesta nada; perder 109 productos en silencio, sí.

Si aun así se quiere usar, hay que comprobar antes cuántas fichas deja fuera el
patrón, no ponerlo a ojo. Para Cestería Aparici se verificó que
`/shop/[^/]+-[0-9]+$` selecciona las 368 fichas y descarta solo las 58 páginas
de categoría, sin perder ninguna.

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

## Publicación (`publicar-pieza.json`)

`POST /webhook/publicar` con `{ "content_item_id": "…" }`. Opcionalmente
`{ "redes": ["instagram"] }` para acotar; por omisión sale en todas las redes
conectadas del cliente.

Los tokens salen de `social_accounts`, no de `client_modules.config`: ese jsonb
lo lee el propio cliente por RLS y un token de página permite publicar en nombre
del negocio. Para llenar la tabla, `scripts/conectar-meta.js` (ver
`docs/conectar-meta.md`).

### Lo que el workflow se niega a hacer

| Situación | Respuesta |
|---|---|
| La pieza no está en `approved`/`scheduled` | «solo se publica lo aprobado» |
| Ya está en `published` | «ya está publicada» — no se republica |
| Sin imagen, o con varias | avisa; los carruseles aún no se publican |
| `format: reel` | avisa; aún no se publican |
| Red no conectada | se salta esa red, sin error |
| Story hacia Facebook | se salta: Facebook no publica stories por API |

### Instagram no publica de una

Son dos llamadas obligatorias y una espera en medio:

1. `POST /{ig_user_id}/media` → devuelve un **contenedor**
2. sondear `GET /{contenedor}?fields=status_code` hasta `FINISHED`
3. `POST /{ig_user_id}/media_publish` con `creation_id`

Meta descarga la imagen **desde internet y sin credenciales** durante el paso 1.
Por eso el bucket de Supabase tiene que ser público: si no, el contenedor falla
con un mensaje que no dice que el problema sea el permiso.

El contador de reintentos se lee de `$('IG esperar').item.json`, **no** de
`IG leer contenedor`. Ese nodo solo se ejecuta una vez: si el contador saliera de
ahí valdría siempre 1, nunca llegaría al tope y el bucle giraría para siempre.

### Facebook: `message`, no `caption`

`POST /{page_id}/photos` con `url` + `message`. `caption` también existe en ese
endpoint, pero es el pie de un enlace: si lo usas, la foto sale sin texto y sin
error. Los hashtags se quitan para Facebook, donde no aportan.

### Una red que falla no tumba la pieza

Si Instagram publica y Facebook no, la pieza queda en `published` con el fallo
anotado en `error`. Marcarla como fallida obligaría a republicar, y eso
duplicaría el post de Instagram. El detalle por red va en `meta.publicaciones`.

Los nodos HTTP llevan `neverError` + `fullResponse`: un 400 de Meta llega como
dato y se convierte en un mensaje legible, en vez de reventar la ejecución con un
volcado.

### Límites de Meta que ya cumplimos

JPEG (no PNG), ratio entre 0,8 y 1,91 (el post 1080×1350 está justo en 0,8),
2200 caracteres de texto, 30 hashtags y 100 publicaciones por cuenta cada 24 h.

### No hace falta App Review

`instagram_content_publish` y `pages_manage_posts` vienen con *acceso estándar*,
que toda app tiene de entrada y sirve para cuentas de personas **con rol en la
app**, esté la app en Desarrollo o en Producción. La revisión (*acceso avanzado*)
solo hará falta para conectar la cuenta de un cliente ajeno.

Lo que sí importa es **con qué caso de uso se creó la app**: Instagram no está
migrado al sistema nuevo de «casos de uso» y solo el caso **«Otro»** (heredado)
expone `instagram_content_publish`. La app del bot de WhatsApp no sirve. Todo el
detalle, y la trampa de los permisos concedidos sobre cero páginas, en
`docs/conectar-meta.md`.

## Cuando contesta una persona en vez del bot

La bandeja del panel permite que alguien del negocio entre en una conversación y
siga hablando él. Para que eso funcione, el bot tiene que **callarse**, y el
workflow tiene dos añadidos:

```
Buscar o crear conversación
  → ¿Responde el bot?
       sí → Cargar historial → ... (flujo de siempre)
       no → Guardar mensaje entrante  ← y aquí se acaba
```

**El mensaje entrante se guarda igualmente.** Si no, al tomar el mando de una
conversación el panel dejaría de recibir lo que escribe el contacto: se vería el
hilo congelado en el último mensaje del bot. Es el error fácil de cometer, porque
todo *parece* funcionar hasta que alguien usa el relevo de verdad.

**El relevo caduca.** La condición no es solo `mode != 'human'`, sino también que
`human_until` no haya pasado. Sin esa segunda parte, cualquiera que abra un chat
y se despiste deja al contacto hablando con nadie. El panel aplica exactamente la
misma regla al pintar el estado.

**El bot levanta la mano, pero no se calla solo.** El contrato JSON con la IA
tiene un campo `escalar`. Cuando viene `true` —el usuario pide una persona, está
enfadado, reclama, pregunta por un pedido concreto— se sella
`handoff_requested_at` y la bandeja destaca esa conversación. El bot responde
igual lo que diga su prompt: quien decide tomar el mando es la persona que mira
el panel, no el modelo. Un bot que se apagara solo dejaría conversaciones mudas
cada vez que alguien escribiera «hola, quiero hablar con alguien» un domingo.

## Enviar desde el panel (`enviar-whatsapp.json`)

```
POST /webhook/enviar-whatsapp
Cabecera: x-kivuk-token: <PANEL_WEBHOOK_TOKEN>
{ "conversation_id": "...", "texto": "...", "sent_by_user_id": "..." }
```

Devuelve `{ ok: true }` o `{ ok: false, mensaje: "..." }` con un motivo legible,
que el panel enseña tal cual bajo el compositor.

**Lleva secreto compartido y los demás webhooks no.** Este manda mensajes de
WhatsApp en nombre de un negocio: abierto a internet sería un buzón de spam con
el número del cliente. Si `PANEL_WEBHOOK_TOKEN` está vacío en el servidor, el
workflow se niega a enviar y lo dice, en vez de dejar pasar todo.

**Vuelve a comprobar la ventana de 24 horas** aunque el panel ya lo haya hecho.
Meta solo acepta texto libre dentro de las 24 h siguientes al último mensaje del
contacto, y entre que alguien escribe y le da a enviar puede haberse cerrado.

**El mensaje se guarda solo si Meta lo acepta.** El nodo de envío va con
`neverError` para poder leer el motivo del rechazo y devolverlo, en vez de morir
sin respuesta y dejar al panel esperando. Se guarda con `role: assistant` (para
que el bot lo entienda como un turno suyo si retoma el hilo) y `sender: human`
(para que la bandeja lo pinte distinto y se sepa quién lo escribió).

## ⚠️ Desplegar sin navegador

`scripts/desplegar-workflow.js` actualiza un workflow que ya existe **y lo
publica**, sin tocar el navegador:

```bash
node scripts/desplegar-workflow.js n8n/workflows/catalogo-ingesta.json            # simula
node scripts/desplegar-workflow.js n8n/workflows/catalogo-ingesta.json --aplicar  # escribe y publica
```

Toma el nombre del propio JSON; si en n8n se llama de otra forma, se pasa como
segundo argumento.

**Importar el JSON desde la interfaz no sirve para actualizar**: crea un
workflow *nuevo* con el mismo nombre y acabas con dos, cualquiera de los cuales
puede atender el webhook.

Y existe porque escribir solo el borrador y pedir un Save+Publish manual falló
tres veces: si la pestaña del navegador estaba abierta de antes, al guardar
mandaba **su** copia vieja encima de la nueva, y el fallo solo se descubría al
ver resultados que no cuadraban.

Lo que hace, en orden, que es el orden que importa: inserta la versión en
`workflow_history` (primero, porque `workflow_entity.activeVersionId` tiene una
clave ajena contra ella), actualiza el workflow, apunta `activeVersionId` a la
versión nueva y reinicia el contenedor. `workflow_published_version` existe pero
se queda vacía; no hace falta tocarla.

### Todo nodo webhook necesita `webhookId`

Un nodo `n8n-nodes-base.webhook` sin `webhookId` en el JSON **activa bien y
registra la ruta**, pero al llegar la primera petición responde:

```
Cannot read properties of undefined (reading 'node')
```

Nada en los logs de arranque lo delata: el workflow aparece como «Activated».

Es un fallo que solo existe desplegando el JSON directamente: al importar desde
la interfaz, n8n inventa el `webhookId` que falte. Por eso puede aparecer
*después* de un despliegue sobre un workflow que ya funcionaba — el despliegue
machaca los nodos y se lleva por delante el id que había puesto la interfaz.

### Borrar desde la interfaz es archivar

n8n no elimina los workflows «borrados»: les pone `isArchived = true` y los
esconde. Siguen en `workflow_entity` con el mismo nombre, así que buscar por
nombre devuelve dos ids. `desplegar.js` filtra por `isArchived = false` y aborta
si aún así hay más de uno.

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
- `META_API_VERSION` — opcional, por omisión `v25.0`. Los tokens de Meta no van
  aquí: viven en `social_accounts`, uno por cliente.
- `PANEL_WEBHOOK_TOKEN` — secreto compartido con el panel para
  `enviar-whatsapp`. El panel lo lee como `N8N_WEBHOOK_TOKEN`.
