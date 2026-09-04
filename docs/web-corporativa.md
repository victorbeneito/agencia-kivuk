# Web corporativa (`agenciakivuk.com`)

El punto 0 de `docs/marketing-y-captacion.md`: el destino que necesitaban todos
los demás. La prospección manda un enlace, la ficha de Google manda un enlace, la
firma del correo lleva un enlace y un anuncio necesita una página de destino. Sin
web, todo eso apuntaba a ninguna parte.

Está construida y desplegable. Lo que falta antes de enseñarla a nadie es
configuración, no código: está al final, en «Qué queda por rellenar».

---

## Decisiones

### Dentro de la misma aplicación, no en un proyecto aparte

La landing vive en `/app`, en el grupo de rutas `src/app/(web)/`. El grupo no
aparece en la URL: solo sirve para que estas páginas tengan cabecera y pie
propios sin heredar nada del panel.

Se hizo así por tres razones, en orden de peso:

1. **La marca es la misma cosa.** Quien contrata pasa de la web al panel el mismo
   día. Compartiendo `globals.css`, la paleta y Poppins, el panel se siente la
   continuación de la web y no otra herramienta comprada aparte.
2. **Un despliegue, no dos.** El mismo build responde en `agenciakivuk.com` y en
   `panel.agenciakivuk.com`. No hay dos pipelines, dos juegos de variables ni dos
   sitios donde mirar cuando algo falla.
3. **Va a dejar de ser estática.** El formulario ya usa una server action; cuando
   exista el CRM (`leads`), esa acción escribirá el lead en Supabase. Un sitio
   estático aparte habría que reconstruirlo entero para eso.

El coste de la decisión: la landing también responde en
`panel.agenciakivuk.com/`. Se asume — por eso `metadataBase` y el canónico
apuntan siempre a `agenciakivuk.com`, y `robots.txt` deja fuera `/panel`,
`/dashboard`, `/login` y `/entrar`. Si Google indexara la landing por el
subdominio, competiría contra sí misma.

### La raíz `/` ya no reparte: eso se mudó a `/entrar`

Antes `/` leía la sesión y mandaba a `/dashboard` o a `/panel`. Ahora `/` es la
landing, y **tiene que poder servirse pregenerada**: leer la sesión la
convertiría en dinámica, y esta es una página que van a abrir desde el móvil, con
datos, después de pulsar un anuncio.

El reparto se mudó a `src/app/entrar/page.tsx`, que no tiene interfaz: mira el
rol y redirige. El login manda ahí en vez de a `/`. Es el único cambio que la web
ha metido en el panel.

### El botón principal abre WhatsApp, y el número está en el entorno

El bot propio de Kivuk es el punto 1 del plan de marketing y todavía no existe.
Para no bloquear la web con eso, el número vive en
`NEXT_PUBLIC_KIVUK_WHATSAPP`:

- **Vacío** (hoy): todos los botones de WhatsApp llevan al formulario de
  contacto, el texto del botón cambia a «Cuéntanos tu caso» y desaparecen las
  frases que prometen una respuesta del asistente. La web funciona entera, solo
  que sin la demostración.
- **Relleno**: los mismos botones abren `wa.me` con un mensaje precargado
  distinto según desde dónde se pulse, y aparecen las frases que explican que al
  otro lado contesta el mismo asistente que se vende.

Rellenar la variable y redesplegar es todo lo que hace falta el día que el bot
exista. No hay que tocar una línea de código.

### El formulario manda un correo y no toca la base de datos

Va por Resend, igual que las facturas, reusando `RESEND_API_KEY`. No escribe en
Supabase porque el sitio donde deben caer los leads es el CRM del punto 2, que no
existe todavía; cuando exista, `(web)/acciones.ts` escribirá el lead **y** seguirá
mandando el correo.

Dos detalles que importan: hay una trampa para robots (un campo oculto que, si
viene relleno, hace que la acción responda «recibido» sin enviar nada), y si el
envío falla el formulario lo dice en vez de dar las gracias — un lead perdido en
silencio es peor que un error a la cara.

### La conversación del hero es HTML, no una captura

`components/web/chat-demo.tsx` dibuja un hilo de WhatsApp con CSS. Pesa nada, se
lee nítido en cualquier pantalla y cambiar el texto no obliga a abrir un editor
de imágenes. Es la única parte de la web que no usa la paleta de Kivuk: los
colores son los de WhatsApp a propósito, porque el reconocimiento instantáneo es
justo lo que hace que la imagen funcione.

El ejemplo transcurre a las **23:41 de un martes**. No es un adorno: el dato que
más convence a un comerciante es el de fuera de horario, porque es dinero que ya
sabe que está perdiendo.

### Sin analítica, y por eso sin banner de cookies

No hay Google Analytics, ni píxel de Meta, ni nada de terceros. Las únicas
cookies son las de sesión del panel, que son técnicamente necesarias y no piden
consentimiento. Eso permite que la política de privacidad diga la verdad con dos
líneas y que la web no arranque con una ventana modal encima.

Si algún día se añade el píxel de Meta para los anuncios de Click-to-WhatsApp,
**hay que volver aquí**: eso obliga a banner de consentimiento previo y a
reescribir esa sección.

---

## Qué hay

```
app/src/app/(web)/
├── layout.tsx              cabecera + pie, metadata y canónico
├── page.tsx                la landing entera (una sola página)
├── opengraph-image.tsx     la tarjeta al pegar el enlace en WhatsApp
├── sitemap.ts
├── acciones.ts             server action del formulario (Resend)
├── formulario-contacto.tsx
├── aviso-legal/page.tsx
└── privacidad/page.tsx

app/src/app/robots.ts       en la raíz de `app/`, no en el grupo (*)
app/src/app/entrar/page.tsx el reparto por rol que antes vivía en `/`
app/src/lib/web/kivuk.ts    datos de la agencia y enlaces de WhatsApp

app/src/components/web/
├── cabecera.tsx, pie.tsx
├── chat-demo.tsx           el ejemplo de WhatsApp del hero y de su pestaña
├── servicios-tabs.tsx      "use client" — las pestañas de Servicios
├── demo-agenda.tsx, demo-redes.tsx    mockups de servicios en producción
├── demo-voz.tsx, demo-correo.tsx      mockups de servicios "en desarrollo"
├── badge-en-desarrollo.tsx
└── pagina-legal.tsx        marco de aviso-legal y privacidad
```

(*) Dentro de `(web)/`, Next no recoge `robots.ts` y `/robots.txt` sale 404 sin
avisar de nada. El `sitemap.ts`, en cambio, sí funciona ahí. Comprobado.

La landing va en este orden, y cada sección está para quitar un motivo por el que
alguien no abriría la conversación:

| Sección | Qué objeción quita |
| --- | --- |
| Hero + chat de ejemplo | «No entiendo qué es esto» |
| El problema | «A mí eso no me pasa» |
| Servicios (pestañas) | «¿Y esto qué incluye?» — ver detalle abajo |
| Cuando entras tú, el bot se calla | «Que una máquina no le conteste una tontería a un cliente bueno» |
| Cómo funciona | «Esto será un lío de montar» |
| Casos | «¿A quién se lo has hecho?» |
| Precio | «Seguro que es carísimo» |
| Preguntas | Las cinco que salen siempre |
| Contacto | La acción |

### Servicios, en pestañas

Antes era una cuadrícula de cuatro tarjetas de texto (`QueHace`). Se cambió el
3/9/2026 a pestañas (`ServiciosTabs`) porque el sitio ya tenía un canal —
WhatsApp— con su propio mockup en el hero, y la petición fue que **cada**
servicio tuviera el suyo, no solo texto. Es el único componente `"use client"`
de la landing: necesita recordar qué pestaña está abierta, y eso exige
`useState`. El resto de la página sigue siendo estática.

Cinco pestañas, en un orden deliberado — primero lo real, después lo que viene:

| Pestaña | Estado | Mockup |
| --- | --- | --- |
| WhatsApp | en producción | reutiliza `ChatDemo`, el mismo del hero |
| Agenda y citas | en producción | `demo-agenda.tsx` |
| Redes sociales | en producción | `demo-redes.tsx` |
| Voz | **en desarrollo** | `demo-voz.tsx`, en gris |
| Correo | **en desarrollo** | `demo-correo.tsx`, en gris |

**La foto de Redes es real, no un mockup.** Es la publicación de
`@hogardetusuenos` del estor con la Torre Eiffel, con el pie de foto tal cual se
publicó. El archivo vive en `public/casos/hogar-estor-paris.png` (1080×1350,
formato 4:5 de Instagram) y el origen es `Pomelli/` en la raíz del repo —
gitignorado a propósito, son los brutos de las piezas de contenido, no algo que
versionar. Por esto mismo la tarjeta usa la identidad de la propia tienda
(«Hogar de tus Sueños», no la cestería): es el único de los tres servicios en
producción donde la tienda propia sí tiene algo real que enseñar.

Voz y Correo llevan `enDesarrollo: true` en el array `SERVICIOS` de
`servicios-tabs.tsx`. Esa marca es la única fuente de verdad: pinta
`BadgeEnDesarrollo` en la pestaña y en el panel, y pone el mockup en gris
(`grayscale`). El día que alguno pase a producción, el cambio es borrar esa
línea ahí — no hay que tocar copy suelto por la página.

**Ojo con lo que significa «Correo» aquí.** No son las campañas de email
marketing de `docs/marketing-y-captacion.md` (mandar correo a una lista); es la
idea contraria — que la IA **lea** la bandeja del cliente, resuma, marque lo
importante y sugiera respuesta. Son dos funcionalidades distintas y ninguna de
las dos existe todavía; que no se fusionen por error el día que se construya
una de las dos.

**Por qué no está el asistente de voz enseñado como si funcionara.** La Fase 3
del plan (`docs/plan-agencia-ia.md`) está en pausa, no en producción. El mockup
lo dice en gris y con la etiqueta encima, y el texto de la pestaña habla en
futuro («estamos llevando», no «ya hace»).

Por el mismo motivo que Voz va marcada «en desarrollo», **Hogar de tus Sueños
salió de la sección de Casos el 3/9/2026**: afirmaba que de la tienda propia
«sale el asistente de WhatsApp», y hoy ahí hay un chat de recomendación de
producto en la web, no un bot de WhatsApp. Vuelve como caso en cuanto sea
cierto.

Solo queda un caso, Cestería Aparici, en genérico («una cestería artesanal»)
hasta que autoricen que se les nombre. No hay logotipos de
empresas que no nos conocen ni cifras inventadas — el día que haya números
reales de conversaciones atendidas, van aquí y esta sección pasa a ser la que
más vende.

---

## Qué queda por rellenar

Nada de esto es código. Sin lo primero, la web no se puede publicar.

1. **Datos fiscales del titular** en `app/src/lib/web/kivuk.ts` (`fiscal.titular`,
   `fiscal.nif`, `fiscal.domicilio`). Los obliga el art. 10 de la LSSI y hoy
   están vacíos: el aviso legal y la política de privacidad marcan el hueco en
   rojo a propósito, para que no se publique así sin darse cuenta.
2. ~~DNS y Caddy~~ — **hecho el 3/9/2026.** La zona se movió a Cloudflare y el
   `Caddyfile` ya sirve el apex y el `www`. El porqué, en «Publicar el dominio».
3. **Variables de entorno** del panel (`app/.env.local.example` las documenta):
   - `CONTACTO_DESTINATARIO` y `CONTACTO_REMITENTE` — si se dejan vacías se usan
     `info@agenciakivuk.com` y el remitente de facturación. Lo imprescindible es
     que el dominio esté verificado en Resend, y ya lo está.
   - `NEXT_PUBLIC_KIVUK_WHATSAPP` — el día que exista el bot de la agencia.
4. **Instagram de la agencia**: `KIVUK.instagram` está vacío y por eso el enlace
   no se pinta en el pie. Se rellena con el handle sin arroba.
5. **Revisar los textos legales con quien lleve la gestoría.** Están escritos con
   los tratamientos y los proveedores reales de la plataforma (Supabase, Contabo,
   Resend, Meta, Google, OpenRouter y OpenAI), pero un repaso de alguien que
   responda de ello no sobra. Falta además confirmar en qué país está el centro
   de datos del VPS: si no es la UE, es una transferencia internacional y hay que
   decirlo en la política de privacidad.

---

## Publicar el dominio

La web la sirve **el mismo contenedor `panel` del VPS** que ya sirve
`panel.agenciakivuk.com`: es una sola aplicación, con la landing en `/` y el
panel en `/panel`. Así que no hay nada que desplegar aparte — solo hay que
decirle al mundo, y a Caddy, que ese dominio es de esta máquina.

### 1. El DNS lo lleva Cloudflare, no Hostalia

Esto costó una mañana entera, así que conviene entender por qué.

El dominio se compró en Hostalia dentro de un «Plan Dominio», y ese plan trae un
servicio llamado **«Tu Web»** que estaba **activo y publicado sobre
`agenciakivuk.com`**. Ese servicio es el dueño del registro A del apex y del
`www`: se pueden editar en su zona DNS, el panel los guarda y los enseña
correctamente, pero **sus servidores autoritativos siguen sirviendo la IP de «Tu
Web»** (`217.116.0.191`). El cambio nunca llega a publicarse y no hay ningún
error que lo diga.

Y no hay forma de soltarlo desde el panel: el menú del dominio → **Destino Web**
solo ofrece «Página Web», «Página de Cortesía» y «Redirección Web». Las tres
apuntan a un servicio de Hostalia. No existe un «ninguno» ni un «servidor
externo».

La salida fue **mover los servidores de nombres a Cloudflare** (plan gratuito).
Con la zona fuera de Hostalia, su «Destino Web» deja de pintar nada. De paso, los
cambios de DNS pasan a tardar segundos en vez de horas, que con más clientes y
más subdominios se agradece.

Cómo se hizo, por si hay que repetirlo con otro dominio:

1. **Descargar la zona** desde Hostalia (DNS → Descargar) como red de seguridad.
2. Añadir el dominio en Cloudflare. Importa los registros solo: fueron **15**,
   que son los 18 de Hostalia menos sus tres `NS`, que Cloudflare sustituye por
   los suyos.
3. **Poner todos los registros A en «DNS only»** (nube gris). Cloudflare los crea
   proxeados por defecto, y eso rompe dos cosas: el correo —`mx`, `smtp`, `pop3`,
   `imap` y `webmail` proxeados devuelven las IPs de Cloudflare y ningún servidor
   puede entregarte nada— y el certificado, porque con el proxy delante Caddy no
   puede emitir ni renovar el suyo.
4. Corregir el apex y el `www` a `169.58.123.119`.
5. En Hostalia: **Dominios y SSL → agenciakivuk.com → CAMBIAR DNS**, quitar los
   tres `servicio-online.net` y poner los dos de Cloudflare.

Estado final de la zona:

| Nombre | Apunta a | Qué es |
| --- | --- | --- |
| `agenciakivuk.com`, `www` | `169.58.123.119` | la web corporativa, en el VPS |
| `panel`, `n8n` | `169.58.123.119` | el mismo VPS (`vmi3485800.contaboserver.net`) |
| `mx`, `smtp`, `pop3`, `imap`, `webmail` | `217.116.0.x` | **el correo, que sigue en Hostalia** |
| MX, SPF, DMARC, `resend._domainkey`, `send` | — | Resend y el correo. **No se tocan nunca** |

Sin esos últimos no salen ni las facturas ni los avisos. Es lo primero que hay
que verificar después de cualquier maniobra con el DNS.

Comprobar preguntando al autoritativo, que es el único que no miente. El `dig` a
secas usa el resolver del sistema, que guarda en caché y te enseña lo de ayer:

```bash
dig +short @chip.ns.cloudflare.com agenciakivuk.com www.agenciakivuk.com
dig +short @8.8.8.8 agenciakivuk.com     # y este, antes de tocar Caddy
```

### 2. Caddy, en el VPS

El `Caddyfile` del repo ya trae los dos bloques nuevos: `agenciakivuk.com` al
contenedor del panel y `www` redirigido al dominio sin www. Solo hay que
desplegar:

```bash
ssh kivuk@169.58.123.119
cd ~/agencia-kivuk/n8n
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
git pull
dc up -d --build panel caddy
dc logs -f caddy        # ver que emite el certificado sin errores
```

**El orden importa.** Caddy pide el certificado a Let's Encrypt en cuanto
arranca, y para emitirlo Let's Encrypt tiene que llegar a esta máquina por ese
nombre. DNS primero, comprobado, y después esto.

### 3. El certificado tarda, y eso es normal

Entre que el DNS es correcto y que `https://agenciakivuk.com` funciona pueden
pasar horas. No es un fallo:

- Let's Encrypt valida **desde varios puntos a la vez y exige que todos
  acierten**. Basta con que uno de sus resolvers conserve la IP antigua en caché
  para que la petición acabe en Hostalia, que no tiene el token, y falle.
- El registro viejo tenía **TTL de 24 horas**, así que hay resolvers rezagados
  durante todo ese tiempo. Se vio en directo: Cloudflare, Quad9 y OpenDNS ya
  daban la IP nueva mientras Google seguía con la vieja.

Cómo saber en qué punto está:

```bash
# ¿Caddy conoce el dominio? Si por el puerto 80 responde 308 con Server: Caddy, sí.
curl -sI http://agenciakivuk.com/ | head -3

# ¿Ya tiene certificado?
curl -sI https://agenciakivuk.com/ | head -1     # HTTP/2 200 = listo

# Los errores del apex, sin tragarse el log entero
dc logs caddy | grep -v "n8n\.\|panel\." | grep agenciakivuk | tail -20
```

**No reiniciar Caddy para acelerarlo.** Reintenta solo, con esperas crecientes.
Cada reinicio lanza intentos nuevos y Let's Encrypt limita a cinco validaciones
fallidas por dominio y hora: lo único que se consigue es agotar el cupo y
retrasarlo más.

Hecho eso, `https://agenciakivuk.com` sirve la landing y `www` redirige a ella.

---

## Lo siguiente

Por orden, y siguiendo `docs/marketing-y-captacion.md`:

- **El bot propio de Kivuk** (punto 1). Es lo que convierte esta web de folleto
  en demostración, y es darse de alta a uno mismo como cliente en el panel.
- **El CRM de captación** (punto 2). En cuanto el formulario empiece a traer
  consultas, un correo suelto en la bandeja deja de ser sitio donde guardarlas.
- **Páginas de servicio para SEO local.** Hoy la web es una sola página, que es
  lo correcto para convertir. Para posicionar «agencia IA WhatsApp [ciudad]»
  hacen falta tres páginas propias, una por servicio. Eso va después de la ficha
  de Google Business Profile, no antes.
