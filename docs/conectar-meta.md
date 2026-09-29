# Conectar una cuenta de Instagram y Facebook

Lo que hay que hacer una vez por cliente para que la plataforma pueda publicar
en su nombre. Son unos 15 minutos, casi todo en la web de Meta.

Al final ejecutas un script que comprueba que todo está bien **antes** de que
montemos nada encima. Si algo falla, falla ahí y no en mitad de una publicación.

---

## Cómo se organizan las cuentas en Meta

Conviene tenerlo claro antes de tocar nada, porque la intuición —«creo un
Facebook de la agencia»— lleva justo al error más caro.

```
Perfil personal (una persona real, administra todo)
        │
        ▼
Portfolio empresarial  ← el centro de todo
        │
        ├── Página de Facebook ── vinculada a ── Cuenta de Instagram
        ├── Cuenta de WhatsApp (WABA)
        ├── Aplicaciones (agencia_kivuk para WhatsApp, Kivuk Social para redes)
        └── Cuenta publicitaria
```

**No se crea un segundo perfil de Facebook para el negocio.** Meta permite uno
por persona; un perfil «de empresa» es un perfil falso, y cuando lo detecta
—mismo móvil, misma IP, mismo navegador— cierra la cuenta y **se lleva por
delante todo lo que administra**: portfolio, WABA, cuenta publicitaria y los
Instagram de los clientes. La figura que se busca es la **página**, que no tiene
inicio de sesión propio y cuelga del portfolio.

El centro tampoco es la página: es el **portfolio**. La página es un activo más,
y no todos los productos dependen de ella:

| Producto | ¿Necesita página de Facebook? |
|---|---|
| WhatsApp Cloud API | **No.** Le basta el portfolio y el negocio verificado |
| Publicar en Instagram | **Sí** |
| Publicar en Facebook | Sí |
| Campañas de pago | Sí |

### Quién debe ser dueño de los activos de un cliente

Dos modelos, y la decisión se corrige mal una vez tomada:

- **Kivuk es dueña de todo.** Cómodo al principio, mala idea después: si el
  cliente se va hay que traspasarle activos que son suyos; si un cliente hace
  algo que a Meta no le gusta, la sanción cae sobre *nuestro* portfolio y
  salpica a los demás.
- **El cliente es dueño y nos da acceso como socio** (botón «Asignar socio», con
  el id de nuestro portfolio). Publicamos igual, y si se va se le retira el
  acceso y ya está.

**Regla: modelo de socio para todo cliente; propiedad directa solo para lo que
es realmente nuestro** (Kivuk Agencia, El Hogar de tus Sueños). La pega honesta
del modelo de socio es que el cliente tiene que crear su portfolio y verificar
su negocio, y eso son papeles con gente que no es técnica. Es una vez.

> Al añadir una cuenta de Instagram, Meta la mete además como **administradora
> con control total del portfolio**, sin avisar. Revísalo después de cada alta:
> «Las cuentas de Instagram son administradores del portfolio», al final de este
> archivo.

---

## Antes de empezar: los dos requisitos que más fallan

### 1. La cuenta de Instagram tiene que ser profesional

Una cuenta personal no puede publicar por API. No hay forma de saltárselo.

> Instagram → Configuración → Tipo de cuenta → **Cambiar a cuenta profesional**

Es gratis, se hace en un minuto y se puede deshacer. Cambia poco de cara al
público: añade estadísticas y la categoría del negocio.

### 2. Vinculada a una **página** de Facebook, no a un perfil

Este es el que engaña. Tener Instagram conectado a *tu cuenta* de Facebook no
sirve: tiene que estar conectado a una **página**.

- Un **perfil** es una persona, tiene amigos.
- Una **página** es un negocio, tiene seguidores.

Si tus 949 seguidores están en una página, ya lo tienes. Si están en un perfil
personal, hay que crear una página — y ojo, **los seguidores no se traspasan
solos**; Facebook tiene una herramienta para convertir un perfil en página que
sí los conserva.

**No se hace desde el Centro de cuentas de Instagram.** Esa pantalla enlaza
*perfiles personales* entre sí (tu Facebook con tus Instagram) y las páginas ni
siquiera aparecen ahí; tocar «Añadir cuentas» solo consigue mezclar la identidad
personal con la del negocio. Es un callejón sin salida que parece el camino.

La vinculación se hace en el portfolio empresarial:

> [business.facebook.com](https://business.facebook.com) → Ajustes → Cuentas →
> **Páginas** → *la página* → **Conectar activos** → *Cuenta de Instagram* →
> **Iniciar sesión en Instagram**

⚠️ Nunca **«Crear perfil de Instagram»**: ese botón crea una cuenta nueva y
distinta, y acabas con dos perfiles del mismo negocio. Y verifica el usuario que
propone el diálogo antes de aceptar — si tienes varias cuentas en el navegador,
te ofrece la de la sesión abierta, que rara vez es la que quieres.

Se puede hacer por la puerta contraria (Cuentas de Instagram → la cuenta →
Conectar activos → Páginas), pero solo funciona si la página ya existe en el
portfolio; si no, el diálogo no ofrece «Páginas» como tipo de activo y parece
que la herramienta está rota.

Comprobación rápida: en Ajustes → Cuentas → Páginas → *la página* → pestaña
**Activos conectados** debe salir la cuenta de Instagram. Si el botón «Conectar
activos» está en gris con un aviso de *«You can only connect one Instagram
Account to each Facebook Page»*, no es un error: es que **ya está vinculada**, y
esa pestaña te dice a cuál.

### La página se crea desde el portfolio, no desde Facebook

> Ajustes → Cuentas → **Páginas** → **Añadir** → *Crear una página nueva*

Así nace siendo propiedad del portfolio y te ahorras el paso de reclamarla. Si
la página ya existía (con seguidores), entonces **Añadir → Reclamar una
página**; no crear una segunda.

Esta página no necesita contenido: existe como anclaje técnico, porque es el
requisito de Meta para publicar en Instagram por API y para que el token no
caduque. Nadie va a visitarla.

---

## La aplicación de Meta

### ⚠️ El caso de uso importa, y no se puede cambiar después

**Crea la app con el caso de uso «Otro»** (aparece como *experiencia heredada* o
*legacy*). No con «Conectar con los clientes a través de WhatsApp», ni con
ninguno de los casos de uso modernos.

Meta está a medio camino entre dos sistemas —«productos», el viejo, y «casos de
uso», el nuevo— e **Instagram no está migrado**. `instagram_content_publish`
sencillamente no se puede pedir desde los casos de uso nuevos: no aparece en el
desplegable de permisos del Explorador y no hay forma de forzarlo.

Consecuencia práctica: **la app del bot de WhatsApp no sirve para esto**, aunque
en teoría una app admita varios productos. Se creó bajo otro caso de uso y el
permiso no existe para ella.

Si te pasa, la señal es inconfundible: en el Explorador de la API, el desplegable
«Añadir un permiso» no ofrece ninguno de los `instagram_*`.

> Que acaben siendo dos apps no es malo: separar WhatsApp de las redes significa
> que un problema en una no tumba la otra.

Esto no está en la documentación de Meta —no documentan su propia migración a
medias—, así que puede dejar de ser cierto el día que la terminen. La
comprobación que vale es siempre la misma: si los permisos aparecen en el
desplegable, la app está bien creada.

### Crear la aplicación

1. Entra en [developers.facebook.com/apps](https://developers.facebook.com/apps)
   y pulsa **Crear aplicación**.
2. Caso de uso: **Otro** (ver el aviso de arriba) → tipo **Empresa**.
3. Ponle un nombre (`Kivuk Social`) y créala.
4. Dentro de la app: **Añadir producto** → **Instagram Graph API**.

La app nace en **modo Desarrollo**, y eso es exactamente lo que queremos.

> **No hace falta App Review.** Los permisos que necesitamos vienen con *acceso
> estándar*, que toda app tiene concedido de entrada y que permite actuar sobre
> cuentas de personas **con un rol en la app** (administrador, desarrollador o
> probador). Como la cuenta es tuya y tú eres el administrador, puedes publicar
> hoy mismo.
>
> Esto **no depende de que la app esté en modo Desarrollo o en Producción**: el
> nivel de acceso es independiente del modo. Da igual si reutilizas una app que
> ya estaba publicada.
>
> La revisión hará falta el día que quieras conectar la cuenta de **otro**
> cliente que no tenga rol en tu app: eso ya es *acceso avanzado*.

### Apuntar App ID y App Secret

> Configuración de la app → **Básica**

El *identificador* está a la vista; el *secreto* aparece al pulsar «Mostrar».

---

## Generar el token

1. Abre el [Explorador de la API](https://developers.facebook.com/tools/explorer/).
2. Arriba a la derecha, elige tu aplicación.
3. En «Usuario o página», elige **Token de usuario**.
4. Añade estos cinco permisos:

   | Permiso | Para qué |
   |---|---|
   | `instagram_basic` | leer la cuenta de Instagram |
   | `instagram_content_publish` | **publicar en Instagram** |
   | `pages_show_list` | ver tus páginas |
   | `pages_read_engagement` | leer la página |
   | `pages_manage_posts` | **publicar en Facebook** |

5. **Generar token de acceso** y acepta el diálogo. Cuando te pregunte a qué
   páginas dar acceso, marca la tuya explícitamente — si la dejas sin marcar, el
   token se genera igual pero sin ella y luego no encuentras la página.

Ese token **dura una hora**. No pasa nada: el script lo canjea por uno duradero.
Solo tienes que usarlo antes de que se te enfríe el café.

---

## Guardarlo y comprobarlo

Añade las tres líneas a `n8n/.env` (ese archivo está en `.gitignore`, no se sube
a ningún sitio):

```
META_APP_ID=...
META_APP_SECRET=...
META_USER_TOKEN=...
```

> Van en el archivo y no en la línea de comandos a propósito: el historial de la
> terminal se guarda en claro, y ahí acabaría el secreto de la app.

Primero, sin guardar nada:

```bash
node scripts/conectar-meta.js
```

Te dice qué permisos lleva el token de verdad, qué páginas encuentra y qué
cuenta de Instagram cuelga de cada una. Los tokens se muestran recortados
(`EAAG…x7Qk`) para que la salida se pueda pegar sin regalar la llave.

Cuando la salida sea la esperada:

```bash
node scripts/conectar-meta.js --guardar <client_id>
```

Guarda las cuentas en `social_accounts`. Se puede repetir sin duplicar.

### Un token con varias páginas: `--pagina`

Si el token cubre las páginas de más de un cliente, hay que decir cuál se guarda
en cada pasada:

```bash
node scripts/conectar-meta.js --guardar <client_id> --pagina <page_id>
```

Sin ese filtro, `--guardar` escribiría **todas** las páginas encontradas bajo el
mismo `client_id`. Con un solo cliente no se notaba; el día que el token trajo
dos páginas, guardar Kivuk habría metido también la página y el Instagram de El
Hogar de tus Sueños en la ficha de Kivuk. El script se planta si detecta más de
una página y te escribe los comandos que necesitas, uno por cliente.

---

## Sobre la caducidad

Hay tres tokens y solo el último importa:

| Token | Dura |
|---|---|
| El del Explorador | 1 hora |
| El de usuario, ya canjeado | 60 días |
| **El de página, el que se guarda** | **no caduca por tiempo** |

El de página es el que usa la plataforma para publicar, tanto en Facebook como
en Instagram. Sí puede invalidarse si cambias la contraseña de Facebook, si
revocas permisos a la app o si Meta pide reautenticación por seguridad. Por eso
la tabla guarda `last_checked_at`: si un día deja de publicar, lo primero es
repetir este proceso.

---

## ⚠️ Tener el permiso no es tener el activo

Con el inicio de sesión para empresas, cada permiso se concede **sobre activos
concretos**. Se puede tener `pages_manage_posts` concedido y cero páginas
detrás: el permiso aparece con un ✓ y no sirve para nada.

Esto engaña muchísimo, porque todas las comprobaciones normales dan verde. La
única forma de verlo es `granular_scopes`:

```
pages_show_list            -> (vacío)              <- el permiso está, la página no
instagram_basic            -> 17841428825124919
instagram_content_publish  -> 17841428825124919
```

El script lo mira y lo dice con esas palabras. Si te pasa, hay que revocar la
autorización anterior antes de volver a generar el token: si no, Facebook
recuerda tus respuestas y se salta las pantallas de selección.

### Cómo revocar la autorización de verdad

La ruta `facebook.com/settings?tab=business_tools` que circula por todas partes
**ya no lleva a ninguna sección de aplicaciones**; redirige a la configuración
general. Buscarla por la interfaz es perder el rato, y además solo aparece si
estás navegando con tu perfil personal y no «como la página» (si Facebook te
enseña opciones raras o le faltan secciones, mira el avatar de arriba a la
derecha: es lo primero a descartar).

Se hace desde el propio Explorador de la API, que no falla:

1. Cambia **GET** por **DELETE**.
2. Ruta: `me/permissions`.
3. **Enviar** → `{"success": true}`.

Eso borra todos los permisos concedidos a esa app. Vuelve a poner **GET** antes
de seguir, y genera el token otra vez.

Al regenerarlo saldrá un diálogo con dos botones, y **el que parece razonable es
el equivocado**:

> *¿Continuar como Fulano? Habías vinculado la app a Facebook. ¿Quieres
> continuar con la configuración anterior?* → **[Editar configuración]**
> **[Continuar]**

«Continuar» significa literalmente *reusar la autorización vieja*, que es la que
no tenía las páginas. Hay que pulsar **Editar configuración** y marcar los
activos uno a uno. Es el punto exacto donde se pierde media hora.

## ⚠️ «Ninguna página» puede significar que está todo bien

Esta es la trampa más cara de todas, porque el diagnóstico se contradice con la
realidad y te manda a rehacer un token que ya era correcto.

`/me/accounts` **solo devuelve las páginas donde eres administrador por el
sistema clásico de roles de página**. Si la página pertenece a un *portfolio
empresarial* y tu acceso te viene de ahí —que es como queda al crearla desde
Ajustes → Cuentas → Páginas—, esa llamada responde `{"data": []}` aunque el
token tenga las páginas perfectamente concedidas:

```
granular_scopes:
  pages_show_list  -> 1344729918716695, 513163282041285   <- las dos, concedidas

GET /me/accounts   -> {"data": []}                        <- y aquí, ninguna
```

Las páginas sí responden si se piden **por su id**, y cada una devuelve su
`access_token` de página (`type: PAGE`, `expires_at: 0`, o sea, sin caducidad).
Por eso el script, desde este arreglo, cae al plan B: si `/me/accounts` viene
vacío pero `granular_scopes` trae ids de página, las pide de una en una. Lo
avisa en la salida:

```
/me/accounts vino vacío; buscándolas por granular_scopes…
```

Nada de esto está en la documentación de Meta. La regla práctica es que
**`granular_scopes` manda sobre `/me/accounts`**: si los ids están ahí, el token
es bueno aunque la lista salga vacía.

## Instagram no necesita el token de página

La documentación de Meta dice que para publicar en Instagram hace falta un
*token de página*. **No es cierto**: un token de usuario con
`instagram_content_publish` concedido sobre la cuenta publica igual.

Comprobado contra la API, no deducido:

```
GET /{ig_user_id}/content_publishing_limit   -> 200 {"quota_usage":0,...}
```

Ese endpoint solo responde si el token puede publicar. Por eso el script guarda
la cuenta de Instagram aunque no haya conseguido ninguna página: Facebook se
queda sin conectar, pero Instagram funciona.

La diferencia real está en la caducidad:

| Token | Dura |
|---|---|
| De página | no caduca por tiempo |
| De usuario | **60 días** — hay que repetir el proceso |

Cuando se guarda un token de usuario, su caducidad va en `token_expires_at`.
Con uno de página ese campo queda a `null`.

---

## ⚠️ Las cuentas de Instagram son administradores del portfolio

> Descubierto el 18/09/2026 revisando la seguridad del portfolio. Nadie las puso
> ahí a mano: salen solas. **Revísalo después de cada alta.**

En **Ajustes → Usuarios → Personas** no solo hay personas. Las cuentas de
Instagram del portfolio aparecen ahí como usuarios de pleno derecho, y nacen con
**control total**:

> «El Hogar de tus Sueños tiene acceso total al portfolio empresarial y puede
> administrarlo todo, incluida la configuración, las personas, las herramientas
> y los activos comerciales. **El Hogar de tus Sueños puede eliminar el porfolio
> empresarial cuando quiera.**»

Traducido: la contraseña de un Instagram es una llave del portfolio entero. Y
como el portfolio administra las WABAs de los clientes, un Instagram phisheado
—que es lo que más se phishea— llega hasta el WhatsApp de un cliente que paga.
Es el «un cliente salpica a los demás» de más arriba, por una puerta que no
estaba contada.

Se ve en la ficha, en «Activos asignados». En su día `@hogardetusuenos` tenía
asignadas las dos cuentas de WhatsApp de **Cestería Aparici**.

### «Suprimir» no funciona, y la salida que ofrece es una trampa

El botón **Suprimir** de esa ficha no quita un acceso: **quita la cuenta de
Instagram del portfolio**. Y si está vinculada a una página, Meta se planta:

> «Esta cuenta de Instagram no se puede suprimir porque actualmente está
> vinculada a una página. Desvincula la página antes de volver a intentarlo.»

**No desvincules la página.** Ese vínculo es el requisito para publicar en
Instagram por API (ver la tabla del principio de este archivo). Desvincular
arregla el diálogo y rompe la publicación.

### Lo que sí se hace

Bajarle el acceso, que no toca la vinculación:

> Personas → la cuenta → **Detalles** → **Administrar** en «Acceso total: Todo» →
> apagar **«Todo»** → en Opciones avanzadas, apagar **Finanzas · Ver** → Guardar

Y quitarle de sus activos asignados todo lo que no sea suyo, con la papelera de
cada fila — sobre todo las cuentas de WhatsApp de otros clientes. Al apagar el
control total, **esa lista de activos pasa a ser el límite real** de lo que puede
hacer, así que limpiarla importa más que antes, no menos.

Queda en «Acceso parcial · Básico». El interruptor «Básico» sale atenuado y no se
puede apagar: es el suelo de cualquiera que esté en el portfolio, y por sí solo
no da nada.

Dos avisos por el camino:

- El aviso naranja —«sin control total, quien inicie sesión con este perfil de
  Instagram no podrá vincularlo a Facebook o WhatsApp, crear cuentas
  publicitarias, gestionar tiendas ni suscribirse a Meta Verified»— habla de
  acciones hechas **iniciando sesión con esa cuenta de Instagram**. Si
  administras desde Facebook, no te afecta. Y el interruptor es reversible.
- **La lista tarda en refrescarse.** Guardas, vuelves a entrar, el diálogo sale
  bien y la lista sigue diciendo «Acceso total». Es caché de la interfaz: F5.

### El aviso rojo que NO hay que arreglar

Esas fichas llevan en rojo un **«Passkey required — This person needs to turn on
passkeys before they can access and manage this business portfolio»**.

Parece un pendiente y es la cerradura: **es lo único que impide entrar al
portfolio con la contraseña de ese Instagram**. No les actives la passkey.

El 2FA sí: protege la cuenta y no desbloquea nada, porque sigue faltándole la
passkey. Y en Centro de seguridad, dejar `Passkey Management` en «Everyone»
convierte el bloqueo en política en vez de accidente.

Como estas cuentas no se pueden sacar del portfolio, **sus contraseñas de
Instagram son llaves del negocio** y merecen contraseña única y 2FA con app.

## El portfolio por dentro: qué hay y qué está vivo

> Mapa del 18/09/2026.

Cinco cuentas de WhatsApp en el portfolio y solo dos importan:

| WABA | Identificador | Número |
|---|---|---|
| Cesteria Aparici | `1064721476544964` | +34 623 82 39 38 — **viva** |
| Cesteria Aparici | `2283693199083614` | sin número — duplicado vacío |
| Agencia Kivuk | `1786850185674194` | +34 623 96 27 33 — **viva** |
| Agencia Kivuk | `1754149562399099` | sin número — duplicado vacío |
| Test WhatsApp Business Account | `2411764119331458` | la `+1 555…` de Meta |

Los nombres se repiten, así que **la pestaña «Números de teléfono» es la que
distingue**: sin número, cascarón. Los duplicados vacíos se dejan a propósito —
uno servirá para el próximo alta, y borrarlos ahora es trabajo que rehacer.

La verdad está en la base de datos, no en el panel de Meta:

```sql
select c.nombre,
       cm.config->>'whatsapp_business_account_id' as waba_id,
       cm.config->>'phone_number_id'              as phone_id
from client_modules cm
join clients c on c.id = cm.client_id
where cm.module = 'whatsapp' and cm.active;
```

### Llave = usuario del sistema. No se borra.

En la pestaña **Personas** de una WABA, la fila con **icono de llave**
(`n8n-agencia-kivuk`) es el **usuario del sistema**: el dueño del token
permanente que hace funcionar los bots. Borrarla deja sin WhatsApp a todos los
clientes a la vez.

Regla para no equivocarse: **llave se queda siempre; cámara de Instagram, fuera.**

Y una asimetría que parece un fallo y no lo es: el usuario del sistema está
asignado a la WABA de Kivuk pero **no** a la de Cestería, y el bot de Cestería
envía igual (comprobado con un mensaje real). No lo «arregles» asignándolo:
funciona, y su token es otro.

### Dónde NO borrar

Dos pantallas se parecen mucho y una es peligrosa:

| Si ves… | Estás en | La papelera borra |
|---|---|---|
| «Propiedad de: Agencia KivuK», pestañas Resumen / Números de teléfono | el **activo** | la WABA del portfolio ❌ |
| El nombre de la persona arriba y cada fila con su nivel de acceso debajo | la **persona** | solo su acceso ✅ |

La vía menos ambigua para quitar accesos es desde el activo: la WABA → pestaña
**Personas** → papelera. Ahí no hay forma de confundir una cosa con la otra.

Después de cada cambio, la prueba que vale es **mandar un WhatsApp real al número
del cliente** y ver si el bot contesta. Para la parte de Instagram,
`node scripts/conectar-meta.js` sin `--guardar`.

## Si algo falla

| Lo que ves | Lo que pasa |
|---|---|
| «Ninguna página» | Mira `granular_scopes`. Si trae ids, no hay nada roto: es `/me/accounts` vacío con páginas de portfolio, y el script las busca por id. Si viene vacío, entonces sí faltó marcarlas al autorizar |
| «/me/accounts vino vacío» | Normal con páginas de un portfolio empresarial. Es un aviso, no un error |
| «instagram sin vincular» | La cuenta no es profesional, o está unida a un perfil y no a una página |
| `code 190` | El token caducó — genera otro, tienes una hora |
| `code 200` | Falta un permiso; el script te dice cuál |
| `code 10` / «requires app review» | Estás actuando sobre una cuenta sin rol en tu app |
| «No se puede suprimir la cuenta de Instagram» | Está vinculada a una página. **No desvincules**: bájale el acceso en vez de borrarla |
| Guardas el acceso y la lista sigue diciendo «Acceso total» | Caché de la interfaz de Meta. F5 |
| «Passkey required» en rojo sobre una cuenta de Instagram | No es un pendiente, es la cerradura. Déjalo |
