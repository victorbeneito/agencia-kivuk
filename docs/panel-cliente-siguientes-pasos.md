# Panel del cliente — Estado y qué queda

El panel al que entra el cliente final ya existe. Este documento dice qué se
construyó, por qué se decidió así, **qué hay que hacer para ponerlo en marcha** y
qué falta todavía.

Antes de tocar nada, leer `CLAUDE.md` (raíz) y `docs/architecture.md`.

---

## 1. Cómo queda repartido

Dos paneles, una sesión. El rol de `user_profiles` decide a cuál entra cada uno.

| Ruta | Quién | Qué hay |
| --- | --- | --- |
| `/login` | todos | email + contraseña |
| `/` | todos | no pinta nada: reparte según el rol |
| `/dashboard/**` | `agency_admin` | el panel de agencia de siempre |
| `/panel` | `client_user` | inicio: lo que espera respuesta o decisión |
| `/panel/conversaciones` | `client_user` | bandeja de WhatsApp con relevo humano |
| `/panel/contenido` | `client_user` | piezas por revisar, aprobadas y publicadas |

Las secciones del panel del cliente **se construyen a partir de sus módulos
activos**. Sin `whatsapp` no hay conversaciones; sin `social` no hay contenido —
ni en la navegación ni como URL: la ruta devuelve 404 si el módulo no está.

El reparto se hace en tres capas, a propósito:

1. **`middleware.ts`** manda a cada rol a su panel. Es navegación, no seguridad:
   una redirección se puede saltar.
2. **`requireAgencia()` / `requireCliente()`** en cada layout y cada página. Esta
   sí corre en el servidor y no se puede saltar.
3. **RLS en Supabase.** La única frontera que importa de verdad, porque el
   navegador habla directamente con la base de datos.

---

## 2. Lo que se cerró en la base de datos

### `0008_rls_panel_cliente.sql` — el agujero que había que tapar

La RLS anterior daba al `client_user` acceso total a `client_modules`, y dentro
de `config` viven el `access_token` de WhatsApp, el `google_client_secret`, el
`refresh_token` de Calendar, la clave de Resend y el token de Instagram. Mientras
no existía ningún usuario de cliente no había hecho daño; el primero que se
creara podía sacarlos todos desde el navegador.

Cómo queda:

| Tabla | La agencia | El cliente |
| --- | --- | --- |
| `clients` | todo | lee su ficha |
| `client_modules` | todo | **nada** — ve `client_modules_publicos` (módulo + activo, sin `config`) |
| `agent_configs` | todo | nada |
| `knowledge_documents` / `_chunks` | todo | nada |
| `catalog_products` | todo | nada |
| `conversations` / `messages` | todo | **solo lectura** |
| `content_items` | todo | **solo lectura** |
| `social_accounts` | todo | nada (ya era así) |

**El cliente no escribe nada directamente.** Lo que sí puede hacer —aprobar una
pieza, tomar el mando de un chat, marcar como leído— pasa por server actions con
`service_role` que comprueban de quién es el dato y si la transición tiene
sentido. Así las escrituras posibles son una lista corta y revisable en vez de
«cualquier UPDATE que se le ocurra al navegador».

Dos funciones nuevas, `es_agencia_del_cliente()` y `es_usuario_del_cliente()`,
sustituyen al subselect copiado en cada política. Toda política nueva debería
usarlas.

### `0009_conversaciones_bandeja.sql` — lo que le faltaba a una bandeja

En `conversations`: `mode` (`bot`/`human`), `human_until`, `handoff_requested_at`,
`last_message_at`, `last_inbound_at`, `last_message_preview`, `unread_count`,
`contact_name`, `assigned_to`. En `messages`: `sender` (`contact`/`bot`/`human`)
y `sent_by_user_id`.

Tres decisiones que conviene no deshacer sin pensarlo:

- **`last_message_at` con trigger, no calculado al vuelo.** Ordenar por
  `created_at` daba el orden equivocado: con el upsert de la 0002 esa fecha es la
  del *primer* contacto.
- **`sender` aparte de `role`.** Un mensaje escrito por una persona es
  `role: assistant` para el modelo (es un turno de su lado, y así lo entiende el
  bot si retoma el hilo) pero tiene que pintarse distinto en la bandeja. Un
  trigger lo rellena a partir de `role` si quien inserta no lo manda, para que
  una versión antigua del workflow no meta datos mal clasificados.
- **`last_message_preview` duplicado.** Sacar el último mensaje de cada
  conversación desde `messages` no se pide en una sola consulta con PostgREST y
  acaba siendo una llamada por hilo. Lo mantiene el mismo trigger, así que no
  puede desfasarse.

`messages` y `conversations` están en la publicación de Realtime. Realtime
respeta la RLS del usuario conectado, así que cada uno recibe solo lo suyo.

---

## 3. El chat con relevo humano

### Cómo funciona de punta a punta

1. Llega un mensaje al workflow `whatsapp-bot`.
2. Tras `Buscar o crear conversación`, el nodo **`¿Responde el bot?`** mira si
   hay una persona al mando y si su relevo sigue vigente.
   - **Hay persona** → `Guardar mensaje entrante` y se acabó. El bot no
     responde, pero el mensaje aparece en la bandeja.
   - **No la hay** → sigue el flujo de siempre.
3. El bot responde y, además, puede levantar la mano: el contrato JSON con la IA
   tiene un campo nuevo, **`escalar`**. Si viene `true`, el nodo `Marcar que pide
   persona` sella `handoff_requested_at` y la bandeja lo destaca.
4. Una persona pulsa **Responder yo** → `mode = 'human'` y `human_until` a dos
   horas vista.
5. Al escribir, el panel llama a `POST /webhook/enviar-whatsapp`, que es quien
   tiene el token de Meta, envía y guarda el mensaje. El panel nunca habla con
   Meta.
6. El mensaje aparece en el hilo por Realtime, sin recargar.

**El relevo caduca solo.** Sin `human_until`, abrir un chat y despistarse deja al
contacto hablando con nadie: el bot callado y ninguna persona mirando. Pasadas
las dos horas el bot vuelve a responder. La interfaz aplica la misma regla
(`relevoVigente()`), para no decir «estás respondiendo tú» cuando ya no es
verdad.

### La ventana de 24 horas

Meta solo deja enviar texto libre dentro de las 24 h siguientes al último mensaje
del contacto; después hacen falta plantillas aprobadas, que no tenemos. Se
comprueba en tres sitios porque el tiempo pasa entre uno y otro: el compositor se
desactiva y explica por qué, la server action se niega a llamar a n8n, y el
propio workflow lo vuelve a mirar antes de enviar.

### La bandeja es un solo componente

`components/bandeja/` lo usan el panel del cliente y el de la agencia con las
mismas capacidades. Dos copias habrían divergido en la primera corrección. En
móvil, lista y conversación se turnan la pantalla — que es como se usará cuando
sea una PWA.

---

## 4. Puesta en marcha (por orden)

Nada de esto está hecho todavía. **El orden importa**: los pasos 1 y 2 van antes
de subir el código, y saltárselo rompe el bot que hoy funciona.

### Dónde vive cada cosa

| Pieza | Dónde | Cómo se despliega |
| --- | --- | --- |
| Migraciones SQL | Supabase gestionado (supabase.com) | a mano, en su SQL editor |
| Panel Next.js | VPS Contabo, contenedor `panel` | `scripts/desplegar.sh` |
| Workflows n8n | VPS Contabo, dentro de la BD de n8n | `scripts/desplegar.sh` |

Supabase **no está en el VPS**: es un servicio gestionado. Ahí no se «despliega»
nada, solo se ejecuta el SQL.

### Paso 1 — Las migraciones, antes que el código

⚠️ **Primero esto, y luego el `git push`.** El panel nuevo lee columnas que
todavía no existen, y el workflow parcheado escribe `sender` en `messages`: si
el código sube antes que las migraciones, PostgREST rechaza el insert y el bot
deja de guardar conversaciones.

En supabase.com → tu proyecto → **SQL Editor** → *New query*. Pegar entero y
ejecutar, uno detrás de otro:

1. `supabase/migrations/0008_rls_panel_cliente.sql`
2. `supabase/migrations/0009_conversaciones_bandeja.sql`
3. `supabase/migrations/0010_avisos_cliente.sql`
4. `supabase/migrations/0011_push.sql`

Y comprobar que quedaron bien:

```sql
-- Debe devolver las columnas nuevas de la bandeja.
select mode, human_until, unread_count, last_message_at
  from conversations limit 1;

-- Debe devolver 'agency access to modules' y NINGUNA que mencione al cliente.
select policyname from pg_policies where tablename = 'client_modules';
```

La comprobación de verdad es con el usuario del cliente, y va en el paso 5.

### Paso 2 — El secreto del webhook de envío

En el VPS:

```bash
ssh kivuk@LA_IP
openssl rand -hex 32          # copia lo que salga
nano ~/agencia-kivuk/n8n/.env
```

Añadir al final:

```
PANEL_WEBHOOK_TOKEN=lo-que-ha-salido-arriba
```

Con una sola variable basta: el compose se la pasa a n8n como
`PANEL_WEBHOOK_TOKEN` y al panel como `N8N_WEBHOOK_TOKEN`. Si falta, el workflow
se niega a enviar y lo dice — que es lo correcto: ese webhook manda WhatsApp en
nombre del negocio y abierto sería un buzón de spam.

En local, lo mismo en `app/.env.local` (`N8N_WEBHOOK_TOKEN`) y en `n8n/.env`.

### Paso 3 — Subir el código

Desde tu máquina:

```bash
git add -A
git commit -m "Panel del cliente: bandeja con relevo humano y RLS cerrada"
git push
```

Y en el VPS:

```bash
ssh kivuk@LA_IP
~/agencia-kivuk/scripts/desplegar.sh
```

O, más cómodo desde Windows, doble clic en **`scripts/desplegar_VPS.bat`**: hace el
`git push` y llama por SSH al script del servidor. Se planta si tienes cambios
sin commitear, porque lo que se despliega es lo que está en GitHub y no lo que
tienes en el disco — desplegar con algo a medias no da ningún error, solo deja
el servidor con una versión que no es la que crees.

El script reconstruye el panel, aplica el compose (que trae la variable nueva) y
actualiza los workflows que hayan cambiado.

**Va a fallar en un punto, y es normal:** `enviar-whatsapp.json` es nuevo y
`desplegar-workflow.js` solo sabe *actualizar* workflows que ya existen. Dirá
«no hay ningún workflow activo llamado "Enviar Whatsapp (panel)"». Se crea a mano
una vez (paso 4) y a partir de ahí el script ya lo mantiene.

### Paso 4 — Crear el workflow de envío en n8n

En `https://n8n.agenciakivuk.com`, sobre un **lienzo vacío**: `⋯` → *Import from
File...* → `n8n/workflows/enviar-whatsapp.json` → **Save** → **Publish**.

Recordatorio de siempre: guardar no es publicar. Sin *Publish*, el webhook no
existe en producción.

### Paso 5 — Comprobar antes de dar accesos

**a) Que el bot se calla.** En Supabase, sobre una conversación de prueba:

```sql
update conversations set mode = 'human',
       human_until = now() + interval '2 hours'
 where id = 'EL-ID-DE-LA-CONVERSACION';
```

Escribir desde el móvil a ese número. El mensaje **tiene que aparecer** en
`messages`, y el bot **no** debe contestar. Si contesta, la versión publicada del
workflow sigue siendo la vieja.

Devolverla después: `update conversations set mode = 'bot', human_until = null …`

**b) Que el cliente no ve credenciales.** Crear el acceso (paso 6), entrar con él
en `https://panel.agenciakivuk.com`, abrir la consola del navegador y pedir:

```js
const { data } = await window.supabase?.from('client_modules').select('*');
```

Si no tienes el cliente a mano en la consola, vale igual con la pestaña Red:
ninguna respuesta debe contener un `access_token`. Lo que sí debe verse son sus
conversaciones.

### Paso 6 — Crear el acceso del cliente

Panel de agencia → el cliente → pestaña **Configuración** → tarjeta *Acceso del
cliente al panel*. Se escribe el email y sale una contraseña temporal **que solo
se ve una vez**: cópiala antes de cerrar. Desde ahí mismo se puede generar otra o
quitar el acceso.

El cliente entra en `https://panel.agenciakivuk.com` y cambia esa contraseña él
mismo en **Tu cuenta**, en su barra lateral.

**Nadie puede saber la contraseña de un cliente, ni tú.** Supabase guarda un
hash bcrypt: un cálculo de ida sin vuelta, que es justo lo que hace que un
volcado de la base de datos no sea un volcado de contraseñas. Para revisar el
panel de un cliente está el botón **Ver su panel** en esa misma tarjeta: entras
con tu propio usuario, ves exactamente lo que ve él, con una barra que lo
recuerda, y sales cuando quieras. Si el cliente ha perdido la suya, se le genera
otra con el botón de la llave.

### Paso 7 — Probar el envío de verdad

Con la ventana de 24 h abierta (es decir, después de que el contacto haya
escrito): abrir la conversación en la bandeja, *Responder yo*, escribir y enviar.
Debe llegar al móvil y quedar en el hilo.

### Paso 8 — Y solo entonces, el prompt

Cuando el cliente esté usando la bandeja y sepamos que la mira, cambiar la frase
de escalado del prompt de Cestería Aparici para que vuelva a prometer respuesta
por WhatsApp (ver `docs/prompt-cesteria-aparici.md`). Prometer una respuesta que
nadie lee es peor que derivar al teléfono.

### Si algo sale mal

```bash
cd ~/agencia-kivuk/n8n
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
dc ps                # estado de los servicios
dc logs -f panel     # errores del panel
dc logs -f n8n       # ejecuciones del bot
```

Volver atrás en el panel es `git revert` + `desplegar.sh`. Las migraciones no se
revierten solas: si hubiera que deshacer la 0008, las políticas viejas están en
`0001_init.sql`, `0003_content.sql` y `0006_rag.sql`.

---

## 5. Lo que falta

- **Aviso en el móvil.** De los tres escalones de aviso, los dos primeros están
  hechos (ver §6); falta el que de verdad resuelve el problema: **notificación
  push**. Va con la PWA — Web Push, claves VAPID, una tabla de suscripciones por
  dispositivo, y iOS con sus reglas (solo funciona si el cliente ha «instalado»
  la web en su pantalla de inicio). La casilla ya existe en la pantalla de
  avisos, desactivada, y la columna `push` está en la tabla esperándola.
- **Citas.** `agenda-api.json` crea el evento en Google Calendar y no guarda nada
  en Supabase, así que no hay de dónde leerlas. Hace falta una tabla
  `appointments` que el workflow rellene al reservar. Es poco trabajo y da
  histórico, filtros y recuento.
- **Llamadas de voz.** Mismo problema: comprobar qué guarda `voz-vapi.json` antes
  de prometer la sección.
- **Nombre del contacto.** La columna `contact_name` existe pero nadie la
  rellena; Meta manda el nombre del perfil en el webhook (`contacts[0].profile.name`)
  y sería un cambio pequeño en `Extraer mensaje`.
- **PWA.** El panel ya cuelga de `/panel`, que es lo que hacía falta para que el
  `scope` del service worker quede limpio. Falta manifest, service worker y, si
  se quieren, notificaciones push (Web Push, permisos, iOS con sus reglas).
- **Marca blanca.** Hoy el cliente ve el logotipo de Kivuk. Si tiene que ver el
  suyo, hace falta logo y colores por cliente.
- **Adjuntos.** La bandeja solo entiende texto. Meta manda imágenes y audios, y
  el workflow los descarta desde el primer día (`message.type !== 'text'`).

---

## 6. Cómo se avisa de que alguien espera

Un aviso que no llega no sirve, y uno que llega de más se acaba ignorando: por
eso cada cliente elige, en **Tu cuenta → Avisos** de su panel (o la agencia por
él, desde *Ver su panel*). Se guarda en `client_notification_settings`, tabla
aparte de `client_modules` justo porque esto sí es una preferencia suya y las
credenciales no.

| Canal | Estado | Cómo funciona |
| --- | --- | --- |
| En el panel | hecho, activado por defecto | `components/avisos-en-panel.tsx`: un cartel en pantalla, el contador en el título de la pestaña y un tono sintetizado con WebAudio. Solo avisa cuando el contador **sube**, para no sonar al marcar como leído. |
| Por correo | hecho, apagado por defecto | El bot, tras marcar `handoff_requested_at`, mira las preferencias y manda un Resend con el mensaje y un enlace a la conversación. Usa las credenciales del módulo `email` del cliente. |
| En el móvil | hecho, se activa en cada dispositivo | Web Push. El navegador da un permiso por **dispositivo** y su suscripción se guarda en `push_subscriptions`. n8n llama a `/api/avisos/push` del panel, que firma con la clave VAPID y envía. |

El cartel en pantalla se añadió después de probarlo: la primera versión eran solo
el título y el sonido, y con el panel delante no se notaba ninguno de los dos —el
título no se mira, y el sonido se lo come la política de autoplay del navegador
si no has hecho clic en esa pestaña desde que cargó—. De ahí también el botón
**Probar el sonido** en la pantalla de avisos: comprobarlo requiere un clic, que
es justo lo que el navegador exige para dejar sonar.

⚠️ **Al depurar con consultas SQL, las horas son UTC.** WhatsApp las enseña en
hora local (en verano, dos más). Comparar una cosa con la otra hace parecer que
llevas dos horas sin guardar mensajes cuando está todo correcto — pasó, y costó
un buen rato de búsqueda. Para verlo en hora local:
`select last_message_at at time zone 'Europe/Madrid' ...`.

⚠️ **El remitente tiene que ser de un dominio verificado en Resend.** Con
`onboarding@resend.dev` —o cualquier dominio sin verificar— Resend acepta la
llamada, crea el registro del correo y lo marca **Failed** sin entregarlo. Como
el nodo va con `onError`, no salta nada en n8n: el fallo solo se ve entrando en
el panel de Resend. Afecta igual a las confirmaciones de cita.

Pendiente de decidir: los avisos van de la agencia al cliente, así que salir de
`agenciakivuk.com` es correcto. Las confirmaciones de cita van del negocio a
*sus* clientes finales y deberían salir del dominio del cliente — lo que implica
verificar el dominio de cada uno en Resend.

Sobre el push, tres cosas que no son evidentes:

- **El permiso es del dispositivo, no del negocio.** Por eso la pantalla de
  avisos no enseña una casilla de sí/no sino «este dispositivo recibe avisos»:
  quien atiende desde el móvil y desde la tablet tiene que activarlo en los dos.
- **En iPhone solo funciona con la app instalada** en la pantalla de inicio.
  Abierta como página normal, Safari ni siquiera deja pedir el permiso — de ahí
  que la PWA fuera antes que el push, y no al revés.
- **Firmar el envío se hace en el panel, no en n8n.** Web Push exige firmar cada
  mensaje con la clave VAPID (ECDSA); en un nodo Code serían cien líneas
  frágiles, y en el panel es una librería. n8n solo llama a
  `/api/avisos/push` con el mismo secreto compartido que usa para enviar
  WhatsApp.

⚠️ **Las claves VAPID se generan una vez y no se cambian.** Si se cambian, todas
las suscripciones existentes dejan de valer en silencio y cada cliente tiene que
volver a dar permiso en su móvil.

### Que la notificación abra la app y no el navegador

Al pulsar un aviso, el service worker mira si ya hay una ventana del panel
abierta. Si la hay, la enfoca —y esa ventana es la app, así que todo va bien—.
Si no hay ninguna, llama a `clients.openWindow()` **y ahí decide el navegador**:
no existe forma de exigirle que abra la app instalada.

Lo que le inclina hacia la app son tres campos del manifiesto: `id` (identidad
estable de la aplicación), `scope` (que la URL del aviso caiga dentro) y
`launch_handler: navigate-existing`. Están puestos en `panel.webmanifest`.

Con el panel abierto a la vez en la app y en una pestaña, se prefiere la app.
La API no distingue una ventana de otra, así que lo cuenta la propia página:
`registrar-pwa` mira `display-mode: standalone` y avisa al service worker, que
apunta el id. Es una pista y no un registro fiable —el navegador puede parar el
service worker y se vacía—, por eso solo sirve para ordenar candidatos, nunca
para descartar ninguno.

📌 **Android guarda una copia del manifiesto al instalar** (el WebAPK). Tocar
`id` o `launch_handler` no cambia nada en un móvil que ya lo tenía instalado
hasta que Chrome se da cuenta, que puede tardar días. Para probarlo: desinstalar
la app del móvil y volver a instalarla.

Dos decisiones de fondo:

- **El correo cuelga de «pide una persona», no de cada mensaje.** Avisar de todo
  es no avisar de nada: a la tercera notificación por un «hola» el cliente crea
  un filtro y deja de leerlos.
- **Que falle el aviso no puede tumbar la ejecución.** Los nodos del correo van
  con `onError: continueRegularOutput`: para cuando se envía, el cliente final ya
  tiene su respuesta y la conversación ya está marcada. Perder el aviso es
  molesto; perder la ejecución entera, peor.

## 7. Decisiones que se tomaron (y cómo revertirlas)

| Decisión | Dónde se cambia si no gusta |
| --- | --- |
| El cliente **no ve** el prompt ni la base de conocimiento | política de `agent_configs` en `0008` |
| El cliente **sí aprueba** contenido, y aprobar lo deja listo para publicar (no publica solo) | `app/src/app/panel/contenido/acciones.ts` |
| El relevo humano dura **2 horas** | `RELEVO_HORAS` en `components/bandeja/acciones.ts` |
| Varios usuarios por cliente | ya soportado; se gestionan desde la ficha del cliente |
| El cliente ve la marca de Kivuk | `components/panel-sidebar.tsx` |
| La vista de agencia sobre el panel de un cliente dura 1 hora | `maxAge` en `app/dashboard/[clientId]/vista.ts` |
