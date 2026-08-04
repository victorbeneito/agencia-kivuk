# Conectar una cuenta de Instagram y Facebook

Lo que hay que hacer una vez por cliente para que la plataforma pueda publicar
en su nombre. Son unos 15 minutos, casi todo en la web de Meta.

Al final ejecutas un script que comprueba que todo está bien **antes** de que
montemos nada encima. Si algo falla, falla ahí y no en mitad de una publicación.

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

La vinculación se hace desde Instagram:

> Instagram → Configuración → **Centro de cuentas** → Cuentas → Añadir → Facebook

Comprobación rápida: si en la app de Instagram, en tu perfil, aparece la página
de Facebook enlazada, vas bien. El script te lo confirma igualmente.

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

El script lo mira y lo dice con esas palabras. Si te pasa, quita la app en
[facebook.com/settings?tab=business_tools](https://www.facebook.com/settings?tab=business_tools)
antes de volver a generar el token: si no la quitas, Facebook recuerda tus
respuestas anteriores y se salta las pantallas de selección.

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

## Si algo falla

| Lo que ves | Lo que pasa |
|---|---|
| «Ninguna página» | Mira `granular_scopes`: el permiso puede estar y la página no |
| «instagram sin vincular» | La cuenta no es profesional, o está unida a un perfil y no a una página |
| `code 190` | El token caducó — genera otro, tienes una hora |
| `code 200` | Falta un permiso; el script te dice cuál |
| `code 10` / «requires app review» | Estás actuando sobre una cuenta sin rol en tu app |
