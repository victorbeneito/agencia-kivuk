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
app/src/components/web/     cabecera, pie, chat de ejemplo, marco legal
app/src/lib/web/kivuk.ts    datos de la agencia y enlaces de WhatsApp
```

(*) Dentro de `(web)/`, Next no recoge `robots.ts` y `/robots.txt` sale 404 sin
avisar de nada. El `sitemap.ts`, en cambio, sí funciona ahí. Comprobado.

La landing va en este orden, y cada sección está para quitar un motivo por el que
alguien no abriría la conversación:

| Sección | Qué objeción quita |
| --- | --- |
| Hero + chat de ejemplo | «No entiendo qué es esto» |
| El problema | «A mí eso no me pasa» |
| Qué hace | «¿Y esto qué incluye?» |
| Cuando entras tú, el bot se calla | «Que una máquina no le conteste una tontería a un cliente bueno» |
| Cómo funciona | «Esto será un lío de montar» |
| Casos | «¿A quién se lo has hecho?» |
| Precio | «Seguro que es carísimo» |
| Preguntas | Las cinco que salen siempre |
| Contacto | La acción |

Los casos dicen la verdad: la tienda propia con su nombre, y Cestería Aparici en
genérico («una cestería artesanal») hasta que autoricen que se les nombre. No hay
logotipos de empresas que no nos conocen ni cifras inventadas — el día que haya
números reales de conversaciones atendidas, van aquí y esta sección pasa a ser la
que más vende.

---

## Qué queda por rellenar

Nada de esto es código. Sin lo primero, la web no se puede publicar.

1. **Datos fiscales del titular** en `app/src/lib/web/kivuk.ts` (`fiscal.titular`,
   `fiscal.nif`, `fiscal.domicilio`). Los obliga el art. 10 de la LSSI y hoy
   están vacíos: el aviso legal y la política de privacidad marcan el hueco en
   rojo a propósito, para que no se publique así sin darse cuenta.
2. **DNS**: `agenciakivuk.com` (y `www`) al mismo despliegue que ya sirve
   `panel.agenciakivuk.com`. Son registros del mismo dominio, no interfieren con
   `n8n.agenciakivuk.com`, que sigue apuntando a la IP del VPS.
3. **Variables de entorno** del panel (`app/.env.local.example` las documenta):
   - `CONTACTO_DESTINATARIO` y `CONTACTO_REMITENTE` — si se dejan vacías se usan
     `info@agenciakivuk.com` y el remitente de facturación. Lo imprescindible es
     que el dominio esté verificado en Resend, y ya lo está.
   - `NEXT_PUBLIC_KIVUK_WHATSAPP` — el día que exista el bot de la agencia.
4. **Instagram de la agencia**: `KIVUK.instagram` está vacío y por eso el enlace
   no se pinta en el pie. Se rellena con el handle sin arroba.
5. **Revisar los textos legales con quien lleve la gestoría.** Están escritos con
   los tratamientos y los proveedores reales de la plataforma (Supabase, Vercel,
   Contabo, Resend, Meta, Google, OpenRouter y OpenAI), pero un repaso de alguien
   que responda de ello no sobra.

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
