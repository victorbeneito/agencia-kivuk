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
| `recordatorios-citas.json` | Reloj cada hora: avisa por WhatsApp a quien tiene cita, con una plantilla aprobada por Meta. Detalle en `docs/recordatorios-whatsapp.md`. |
| `voz-vapi.json` | Adaptador entre las tool calls de Vapi (agente de voz) y la Agenda API. |
| `catalogo-ingesta.json` | Recorre el sitemap de la tienda de un cliente y vuelca sus productos en `catalog_products`. |
| `contenido-generar.json` | Elige productos del catálogo, pide los copys a la IA, manda renderizar la pieza y la deja pendiente de aprobación. |
| `whatsapp-bot-v1-calendar.json` | Copia de seguridad de la primera versión (sin memoria, email ni disponibilidad). |
| `agenda-api-v1-un-trabajador.json` | Copia de seguridad de la Agenda API anterior, la de un solo calendario por negocio. |

## Agenda API

Un solo sitio donde vive la lógica de agenda, para que cada canal (WhatsApp, voz,
y lo que venga) no tenga su propia copia. Se llama por HTTP:

```
POST /webhook/agenda
{ "client_id": "...", "accion": "disponibilidad", "fecha": "2026-08-04" }
{ "client_id": "...", "accion": "reservar", "fecha": "...", "hora": "12:30",
  "servicios": ["corte", "mechas"], "trabajador": "Ana",
  "email": "...", "contacto": "34600111222", "nombre": "Marta" }
```

`servicios` y `trabajador` son **texto libre y opcionales**: el motor los
empareja contra el catálogo real del negocio. Sin ellos, la cita dura lo que
diga el módulo y la atiende quien esté libre.

Devuelve siempre un `mensaje` ya redactado, listo para leer en voz alta o enviar
por WhatsApp, además de los datos estructurados (`dias`, `alternativas`,
`trabajador`).

### Varios trabajadores, varios servicios

Desde la migración `0014`, un negocio no es una agenda: es un conjunto de
personas con su horario, y una lista de servicios con su duración y su lista de
quién sabe hacerlos. El razonamiento completo está en `docs/agenda-multiple.md`;
lo que hay que saber para tocar esto:

- **La verdad son las citas de Supabase** (`appointments`), no Google Calendar.
  `freeBusy` devuelve franjas ocupadas *anónimas* —dice "de 17 a 18 ocupado", no
  de quién—, y con varios trabajadores eso no sirve para saber quién está libre.
  Google queda como espejo por persona: sirve para que cada una vea sus citas en
  el móvil y para que el bot respete lo que se bloquee ella misma.
- **Que Google falle no puede dejar a un negocio sin citas.** `Refrescar token`,
  `Cargar ocupación`, `Crear evento` y `Guardar id del evento` van todos con
  `onError: continueRegularOutput`. Un cliente sin Google conectado recorre el
  workflow entero igual.
- **La reserva la hace Postgres, no el workflow.** `agenda_reservar` (migración
  `0015`) inserta la cita y sus servicios en una transacción y captura el choque
  con la restricción `appointments_sin_solape`. Entre calcular un hueco y
  reservarlo cabe otra conversación, y esa carrera no se gana comprobando antes:
  se gana dejando que la base lo impida. Si llega tarde, el nodo `Respuesta hueco
  perdido` lo dice como lo que es —"acaban de coger esa hora"— y no como un error.
- **Una sola llamada para todo el contexto.** `agenda_contexto` devuelve
  configuración, trabajadores con horarios y ausencias, servicios y citas del
  periodo en un JSON. A nodo HTTP por tabla eran seis llamadas encadenadas en
  cada mensaje de WhatsApp.
- **Las credenciales de Google no viajan en ese JSON.** `agenda_contexto`
  devuelve solo `duracion_min`, `paso_min` y `zona`, y no el `config` entero del
  módulo, que es donde viven el `client_secret` y el `refresh_token`. Esos los
  lee su propio nodo, que es el único que los usa.

### El motor vive en un fichero, no en los nodos

`n8n/logica/motor-agenda.js` es la única copia de la lógica de huecos, y
`construir-workflows.js` la inyecta dentro de los nodos Code marcados:

```bash
node n8n/logica/construir-workflows.js          # regenera los workflows
node n8n/logica/construir-workflows.js --check  # falla si están desactualizados
node n8n/logica/motor-agenda.prueba.js          # 85 comprobaciones del motor
node n8n/logica/nodos.prueba.js                 # el pegamento con n8n (agenda e inmuebles)
node n8n/logica/recordatorios.prueba.js         # 41 del nodo de recordatorios
```

Un nodo se marca poniendo estas dos líneas en su `jsCode`, y el script escribe
el motor entre ellas:

```js
// <<< MOTOR >>>
// <<< FIN MOTOR >>>
```

Las marcas se conservan, así que el script es idempotente. **Lo que se edite en
el editor de n8n dentro de ese bloque se pierde en la siguiente generación**: el
sitio donde se cambia la lógica es el fichero.

Por qué existe todo esto: antes la misma función de parseo de horas estaba
copiada a mano en tres nodos, y cada corrección había que hacerla tres veces. Y
sobre todo, un fichero suelto se puede ejecutar con `node` y comprobar contra
ochenta casos **antes** de tocar el workflow que está dando citas de verdad.

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

## Recordatorios de cita

`recordatorios-citas.json` es el primero que no lo llama nadie: lo dispara un
reloj cada hora. Lee las citas confirmadas que aún no se han avisado, mira quién
tiene el recordatorio encendido y manda una **plantilla aprobada por Meta**,
porque fuera de las 24 horas desde el último mensaje de la persona no se puede
escribir texto libre.

El razonamiento entero —la plantilla, la ventana rodante, por qué se marca la
cita solo cuando Meta acepta— está en `docs/recordatorios-whatsapp.md`.

**Un workflow nuevo se crea con `--crear`, no desde la interfaz:**

```bash
node scripts/desplegar-workflow.js n8n/workflows/recordatorios-citas.json --crear --aplicar
```

Porque **«Import from File» importa DENTRO del workflow que tengas abierto**.
Se aprendió por las malas: importando este mismo fichero con el bot de WhatsApp
en pantalla, el bot pasó a tener 61 nodos —los suyos 50 más los 11 nuevos— y a
llamarse «Recordatorios de citas». Y como el despliegue busca por nombre, a
partir de ahí el del bot no encontraba nada y el de los recordatorios habría
machacado el bot entero. Ninguno de esos dos pasos da un error visible.

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

### Un matiz que el modelo no puede resumir hay que subirlo de rango

Caso real (Kivuk, 04/09/2026). El documento decía que la web incluye un dominio
`.es` estándar **y** que uno más caro lo paga el cliente. El bot contaba siempre
la primera mitad y se comía la segunda, que es justo la que evita una promesa que
después hay que retirar.

Se intentó pedírselo de tres formas, cada una más contundente, y **fallaron las
tres**:

1. Las dos ideas en el documento, en dos frases. Cita la primera.
2. Las dos en **la misma frase**, la del precio, que es la que copia. La parte
   en la mitad de atrás, y la recorta igual.
3. Un bloque propio en el `system_prompt`, en mayúsculas, con las frases
   literales, marcado como REGLA ABSOLUTA y con una orden de prioridad
   explícita: *«si tienes que acortar, quita cualquier otra cosa antes que
   esta»*. Siguió recortándola.

Conviene subrayarlo porque el intento 3 parece infalible y no lo es. En la misma
sesión, un bloque idéntico en forma —`[SI TE PIDEN HABLAR CON UNA PERSONA]`, con
su REGLA ABSOLUTA— sí se cumplió a la primera. **La misma técnica funcionó para
una regla y no para otra**, así que no hay forma de saber de antemano si va a
agarrar.

Lo que sí funcionó fue dejar de pedírselo: **quitarle la posibilidad de decirlo
mal.** El dominio se sacó del documento de la web y se le dio uno propio. Si el
contexto no habla de dominios, el modelo no puede prometer nada sobre ellos; y
cuando preguntan por el dominio, se recupera un documento donde las dos mitades
son la respuesta entera, no un adorno de otra cosa.

**La lección, que es la misma que ya está escrita en
`docs/traspaso-whatsapp-cliente-real.md`: un prompt no es una garantía.** Si algo
*tiene* que aparecer siempre —un aviso legal, una condición de precio, un
descargo—, no se pide en el prompt: o se diseña el contexto para que no exista la
versión incompleta, o se comprueba en código después de la respuesta. Pedírselo
al modelo funciona la mayoría de las veces, y «la mayoría de las veces» no sirve
para una condición comercial.

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
- **Un «no» es un no.** A *«¿Te la reservo?»* se le contestó **«No hace falta»**
  y la IA lo leyó como *«no hace falta que preguntes»*: devolvió
  `confirmar: true` y la cita se creó (visto en la demo dental el 28/09/2026).
  Como el resto de datos, la última palabra la tiene el código: `Decidir acción`
  mira si el mensaje **entero** es una negativa («no», «no hace falta»,
  «déjalo», «mejor no», «ya no»...) y entonces ni reserva ni comprueba —volver a
  ofrecer el hueco después de un no es no haber escuchado—, y si la IA ya había
  escrito la confirmación en su respuesta, la sustituye por una línea neutra.
  Solo cuenta el mensaje entero: *«no me va bien el lunes, resérvame el martes»*
  también empieza por «no» y sí es una reserva. Las dos cosas están probadas en
  `n8n/logica/nodos.prueba.js`.
- **Una persona, una cita futura.** Al día siguiente apareció el otro lado del
  mismo agujero: cita confirmada para el martes, *«mejor el miércoles»*, y el bot
  reservó **otra** sin tocar la del martes. El bot no sabe cambiar citas, así que
  hace lo único que sabe. Ahora `agenda_reservar` (migración `0020`) mira si ese
  teléfono ya tiene una cita futura y, si la tiene, devuelve `ya_tiene_cita` en
  vez de crear la segunda; la API lo cuenta con el día y la hora de la que ya
  tiene, y **escala al equipo**, porque moverla es trabajo de una persona. Desde
  el panel (`canal = 'panel'`) no se bloquea nada: quien está en el mostrador ve
  la agenda y sabe lo que hace. El razonamiento completo, en
  `docs/agenda-multiple.md`.
- **Y el bot mueve la cita** (migración `0021`). La IA marca `cambiar_cita`, el
  bot manda `accion: 'mover'`, la API busca la cita de ese teléfono
  (`agenda_cita_futura`), el motor comprueba el hueco nuevo —sin contar el que
  ocupa ella misma, para lo que `agenda_contexto` devuelve ahora el `id` de cada
  cita— y `agenda_editar` la cambia. En dos pasos, como una reserva: *«está
  libre, ¿te la cambio?»*. Si tiene evento en Google, se mueve también. Sin
  cita, con dos citas, si piden cambiar de persona estando en Google o si el
  cambio falla por algo que no sea «ocupado», se avisa al equipo.
- **Y la anula**, igual: `anular_cita` en la IA, `accion: 'anular'`, pregunta
  *«¿seguro?»*, y con el sí `agenda_cancelar` + borrar el evento de Google. El
  cambio y la anulación mandan un `aviso` al negocio por los canales de
  siempre (`¿Hay que avisar?`), sin marcar la conversación como «pide una
  persona». Detalle en `docs/agenda-multiple.md`.
- **Anular siempre pregunta, lo diga o no la IA.** En la primera prueba real
  (29/09/2026) *«no voy a poder ir»* anuló la cita a la primera: la IA marcó
  `confirmar: true` pese a que el prompt pedía lo contrario. `Decidir acción`
  solo da por confirmada una anulación si **lo último que dijo el bot** (según
  `Cargar historial`) fue *«¿Seguro que quieres anular…?»*. Mover no lleva esa
  regla a propósito: *«cámbiamela al jueves a las 11»* es una orden clara, como
  *«resérvame el jueves»*, y una cita movida se puede volver a mover; una
  anulada, por el chat, no.

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

## El bot dice que es un asistente

Quien escribe tiene que saber que le contesta un asistente automático y no una
persona. Lo promete el contrato con los clientes (`docs/legal/`, cláusula 4.3) y
lo exige el art. 50 del Reglamento europeo de IA. Antes solo lo decía si se lo
preguntaban. Añadido el 29/09/2026, para todos los clientes a la vez.

**Cuándo** lo decide `Preparar contexto`, con el historial (que para esto trae
también `sender` y `created_at`):

- conversación nueva: no hay ningún mensaje nuestro;
- lo último que se le escribió lo escribió una persona desde el panel: si ahora
  contesta el bot sin decir nada, creería que sigue hablando con ella;
- el bot no le escribe desde hace más de 30 días.

Los recordatorios de cita se guardan con `sender: 'bot'`, así que contestar a
uno no provoca otra presentación.

**Qué dice** lo redacta la IA, en un campo aparte del JSON (`presentacion`),
porque es la que sabe cómo se llama el negocio: en la base de datos solo está el
nombre interno (`Peluqueria Mechas`, sin tilde), y cada prompt ya lleva el bueno.
Se le pide en el idioma en que le escriben.

**Que salga** lo garantiza `Respuesta final`, en código:

- La pone delante de lo que se vaya a enviar. Por eso no va dentro de `reply`:
  cuando alguien pide hora, lo que se envía es el texto de la agenda, no el de
  la IA, y la presentación se habría perdido.
- Si no la ha escrito, o no deja claro que es un asistente, pone una genérica
  («Hola, te atiende un asistente virtual.»).
- Quita el saludo del principio de la respuesta, para que no salgan dos «Hola»
  seguidos.
- Si la IA ya se ha presentado dentro de la respuesta, no la repite. Para eso
  tiene que decir «soy el asistente…»: que salga la palabra «bot» no cuenta,
  porque el bot de Kivuk habla de bots en cada respuesta.

**Lo que sobra es el saludo, no las cortesías.** La instrucción decía «reply
empieza directamente por la respuesta», y el modelo lo entendía como «nada de
cortesías». Cestería pide en su prompt agradecer el primer mensaje y preguntar
el nombre, y a un «hola» a secas el bot contestaba «¿En qué puedo ayudarte?» y
nada más. Desde el 02/10/2026 la instrucción prohíbe repetir el saludo y la
presentación, pero deja explícitamente en `reply` lo que el prompt pida para el
primer mensaje.

## Solicitudes de presupuesto por correo

Un cliente puede querer que las peticiones de precio que recoge el bot le
lleguen a un buzón concreto, con los datos ordenados. Lo pidió Cestería en su
guía del bot: «toda petición de presupuesto que entre por WhatsApp tiene que
acabar en info@; ahora mismo no quedan registradas en ningún sitio».

**Es opcional por cliente, en dos sitios.** El prompt del cliente le pide al bot
recoger los datos (producto, medidas, unidades, email, dirección, nombre), y el
cliente pone en `/panel/cuenta` a qué correo los quiere
(`client_notification_settings.email_presupuestos`, migración `0024`). A quien
no tiene ninguna de las dos cosas no le cambia nada: el campo `presupuesto` del
JSON se queda en `null`.

**El recorrido.** El modelo rellena `presupuesto` en el mensaje en que completa
los datos. Una rama nueva sale de `Guardar mensajes`, en paralelo al aviso de
«pide una persona» (ninguno depende del otro):

`¿Trae presupuesto?` → `Preparar presupuesto` → `Registrar presupuesto` →
`¿Es nuevo?` → `Correo de presupuestos` → `¿Tiene correo de presupuestos?` →
`Credenciales para el presupuesto` → `Enviar presupuesto` → `Anotar a dónde se
mandó`.

- Se registra **siempre** en `presupuestos_whatsapp`, tenga o no correo
  configurado: así ninguna solicitud se pierde.
- **No se manda dos veces.** El modelo puede volver a rellenar el presupuesto en
  el mensaje siguiente («¡gracias!»), con los mismos datos aún a la vista. La
  tabla tiene una `huella` (md5 de teléfono, producto, medidas, email y
  dirección) única por cliente, y el insert va con `ignore-duplicates`: si ya
  existía, vuelve vacío y la rama se para en `¿Es nuevo?`. Si la persona corrige
  un dato, la huella cambia y sale otro correo, que es lo correcto.
- El HTML se monta en `Preparar presupuesto` y no en el nodo de Resend porque
  lleva texto escrito por el cliente final, y hay que escaparlo.
- El correo lleva `reply_to` con el email del cliente final cuando es válido:
  responder al correo es contestarle a él.
- Toda la rama tolera errores (`continueRegularOutput`): si se despliega antes
  de aplicar la migración, falla en silencio sin tocar la respuesta ni el aviso.

## Cartera de inmuebles (módulo `inmuebles`)

Para una inmobiliaria, el bot busca en su cartera con filtros: operación, tipo,
municipio, zona, precio, habitaciones, extras. Migración `0025`; la cartera se
sube con `scripts/cargar-inmuebles.js`. Añadido el 05/10/2026 para la demo
inmobiliaria (`docs/demo-inmobiliaria-llaves.md`).

**Por qué no vale lo que ya había.** El conocimiento busca por parecido de
significado y el catálogo por palabras. Ninguno entiende «menos de 150.000 € y
tres habitaciones»: el vectorial trae el chalet de 435.000 porque «se parece».

**El reparto es el de la agenda.** La IA solo extrae; decide la base; redacta
el código:

```
Recoger productos → Cartera de inmuebles → Consultar agenda → …
  … → Decidir acción → ¿Consultar agenda?
        sí → (agenda, como siempre)
        no → ¿Buscar inmuebles?
               sí → Buscar inmuebles → Respuesta con inmuebles → Respuesta final
               no → Respuesta sin agenda ──────────────────────→ Respuesta final
```

- `Cartera de inmuebles` (`inmuebles_cartera`) le da a la IA **lo que existe**:
  tipos, municipios con sus zonas, extras y horquillas de precio. No las
  fichas. Con eso traduce «San José» a `Sant Josep` y «una casa» a los tipos de
  casa que hay. Sin la lista, inventa zonas plausibles y la búsqueda no
  encuentra nada por un nombre mal escrito.
- La IA rellena el campo `inmuebles` del JSON con **todos** los criterios de la
  conversación, no solo los del último mensaje. `Decidir acción` los limpia:
  «compra» pasa a `venta`, «150.000» y «150 mil» a 150000, y «hasta 150» en una
  compra a 150.000. Si en el mismo mensaje hay algo de agenda, gana la agenda.
- `buscar_inmuebles` cumple siempre lo que la persona pone como condición. Solo
  afloja dos cosas, marcadas y de una en una, para rellenar: hasta un 10 % por
  encima del tope (`se_pasa`) u otra zona del mismo municipio (`otra_zona`). Lo
  reservado no sale en las búsquedas, pero sí al preguntar por su referencia,
  para poder decir que está reservado.
- **La lista la escribe `Respuesta con inmuebles`, no la IA.** Por lo mismo que
  los precios del catálogo: un modelo que reescribe cifras alguna vez cambia
  una. A la IA se le pide `reply` vacío, y en las pruebas con gpt-4o
  (06/10/2026) no lo dejó vacío casi nunca: «Estoy buscando opciones para ti»,
  «Necesito saber tu presupuesto…», «Un moment, si us plau», encima de una
  lista que ya estaba. Así que el nodo lo filtra **frase a frase**: quita las
  que anuncian la búsqueda, las preguntas (el cierre del sistema ya pide lo
  que falta), las que traen cifras o referencias y las entradillas acabadas en
  «:», y deja el resto («Gracias por escribirnos»).
- Con muchos resultados enseña tres, dice cuántos hay y pide lo que falta para
  afinar (zona, presupuesto, habitaciones o metros). Sin resultados, ofrece
  aflojar algo o pasar la búsqueda a un comercial.
- **No repite y no rellena con otras zonas** (migración `0026`). En la primera
  prueba real (06/10/2026) pidieron vivienda en Sant Josep, donde solo hay dos,
  y a «¿no tienes nada más?» salían las mismas tres fichas una y otra vez, una
  de ellas de La Vila, que nadie había pedido. Ahora `Decidir acción` saca del
  historial las referencias ya enseñadas (`*Ref. 104*`) y las manda en
  `excluir_refs`; la función las deja fuera y las cuenta en `vistos` («aparte de
  los que ya te he enseñado…»). Otra zona ya no entra en la lista: se cuenta en
  `otras_zonas` y se ofrece («en otras zonas de Ontinyent tengo 3 más, ¿te los
  enseño?»). Por eso la función devuelve un objeto y no filas: el recuento
  tiene que llegar aunque no haya ninguna ficha que enseñar.
- **Aceptar esa oferta lo decide el código.** Se le pedía a la IA que quitara la
  zona al oír «sí», y la dejó puesta tres veces seguidas: la misma oferta en
  bucle. `Decidir acción` mira si lo último que dijo el bot fue la oferta y si
  la persona acepta («sí», «vale», «enséñamelos») o pide más («¿no tienes nada
  más?»), y entonces busca sin la zona. Es el mismo patrón que el «no» de las
  citas.
- Los dos nodos HTTP van con `alwaysOutputData` y `continueRegularOutput`. Una
  búsqueda vacía no corta el flujo. Una base caída no deja al bot mudo: lo dice
  y escala.

A quien no tiene el módulo no le cambia nada: no ve la cartera, `Decidir
acción` deja `inmuebles` en `null` y la rama es la de siempre. Lo único nuevo
para todos es la llamada a `inmuebles_cartera`, que con la cartera vacía
devuelve `total: 0`.

Probado contra un Postgres de verdad (PGlite, con `unaccent`) y con la salida
real guardada en `n8n/logica/inmuebles-ejemplo.json`, que es lo que usa
`nodos.prueba.js`. Si cambia la función o la cartera de la demo, hay que
regenerar ese fichero.

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

## ⚠️ Una ejecución en verde no significa que funcione

Los tres fallos del 04/09/2026 tenían la misma forma: **el bot respondía con
normalidad, n8n marcaba la ejecución como *Succeeded*, y aun así no hacía lo que
debía.** Uno llevaba roto un mes sin que nadie lo notara.

La causa común es que varios nodos están configurados con `onError:
continueRegularOutput` — decisión correcta, porque más vale contestar sin la foto
que dejar al cliente esperando. Pero el efecto secundario es que **el error deja
de ser un error** y se convierte en un item vacío que sigue camino.

Regla práctica: **cuando algo "no hace nada" pero no hay rojo, no mires el estado
de la ejecución, mira la salida del nodo sospechoso.** Y cuando el síntoma sea
"la base de datos no tiene lo que debería", compáralo contra la tabla: la fecha
del último registro bueno te dice qué cambio lo rompió.

### Caso 1 — Insertar varias filas: todas deben tener las mismas claves

`Guardar mensajes` inserta dos filas de golpe (la del usuario y la del bot).
PostgREST responde `400 Bad request — All object keys must match` si los objetos
del array no tienen **exactamente** el mismo juego de claves.

La migración `0012_adjuntos` añadió `media_path`, `media_type` y `media_name` al
primer objeto y no al segundo. Resultado: **no se guardaba ninguno de los dos**,
ni el del bot ni el del usuario, desde el 06/08/2026. El bot seguía contestando
porque el guardado va *después* de `Responder por Whatsapp`.

Al añadir una columna a una inserción múltiple, hay que añadirla a **todos** los
objetos, aunque sea con `null`.

### Caso 2 — `binary.data.data` no es el base64

`Imagen a base64` construía el data URI con `bin.data`. Con
`N8N_DEFAULT_BINARY_DATA_MODE=filesystem` —el modo por defecto en producción—
ese campo **no contiene los bytes**: contiene un identificador, literalmente la
cadena `filesystem-v2`. El data URI salía como
`data:image/jpeg;base64,filesystem-v2` y OpenAI devolvía `invalid_image_format`.

Se arregla pidiendo los bytes al helper, que funciona en los dos modos:

```js
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const base64 = buffer.toString('base64');
```

Ojo con el respaldo: si se hace un `catch` que se conforme con `bin.data`, se
vuelve al mismo fallo. El del workflow comprueba además que la cadena **parezca**
base64 (más de 200 caracteres) y no un identificador corto. Esa comprobación es
la que habría delatado el fallo en agosto en vez de dejarlo llegar a OpenAI
disfrazado de imagen válida.

Los nodos HTTP sí resuelven la referencia solos: `Transcribir audio` manda el
fichero sin problema. Solo falla cuando un nodo Code manipula el binario a mano.

### Caso 3 — Un fallo hunde toda la cadena que va detrás

`Guardar mensajes` no es una hoja del árbol:

```
Responder por Whatsapp → Guardar mensajes → ¿Pide una persona? → Marcar que pide persona
                                                                 → avisar por correo
                                                                 → avisar al móvil
```

Al reventar el guardado, **murieron también el relevo humano y los tres canales
de aviso**. Se investigaron como tres fallos distintos durante un buen rato: eran
uno. Antes de dar por hecho que hay varios problemas, mira si comparten rama.

> Hubo un cuarto fallo el mismo día, este en el panel y no en n8n: el botón
> Guardar de los avisos apagaba el `push` que acababa de encender el móvil. Está
> contado en `docs/panel-cliente-siguientes-pasos.md`, sección 6.

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
