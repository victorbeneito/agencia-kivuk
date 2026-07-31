# Servicio de render

Compone las piezas para redes sociales (posts, stories y, más adelante, reels) a
partir de las fotos reales del catálogo del cliente. n8n lo llama por HTTP, igual
que llama a la Agenda API.

```
POST http://render:3001/imagen        (desde n8n, misma red de Docker)
POST http://localhost:3001/imagen     (desde fuera)
```

```json
{
  "client_id": "25fb4723-...",
  "formato": "post",
  "titular": "Estor zen con estampado digital",
  "pie": "@hogardetusuenos · Medida a tu gusto",
  "producto": { "image_url": "https://...", "price": 55.15, "currency": "EUR" },
  "marca": { "primario": "#6D9AAC", "secundario": "#CEB38D" },
  "subir": true
}
```

Con `subir: true` sube el JPEG a Supabase Storage y devuelve `{ ok, url, ... }`.
Con `subir: false` devuelve el JPEG en crudo, que es lo cómodo para mirar el
resultado mientras se ajusta la plantilla.

| Formato | Tamaño | Para qué |
| --- | --- | --- |
| `post` | 1080×1350 | feed (vertical 4:5, el que más ocupa en pantalla) |
| `story` | 1080×1920 | stories |
| `cuadrado` | 1080×1080 | feed cuadrado |

## Por qué es un servicio aparte y no nodos de n8n

Dos motivos. La imagen de n8n **no trae ffmpeg**, así que los reels no pueden
salir de ahí. Y el diseño de una plantilla —recortar, escalar, redondear,
componer texto— encadenado en nodos de imagen se vuelve imposible de mantener en
cuanto tiene más de tres pasos, mientras que aquí es código normal que se puede
leer y probar.

## Decisiones de la plantilla

**El producto no se estira sin límite.** Las tiendas sirven como mucho 800 px y
la pieza es de 1080. Se permite ampliar hasta 1,45× —que a ese tamaño no se
aprecia— pero no más; pasado ese punto se ve blando. El resto del lienzo lo
ocupa el fondo de marca, que además hace que la pieza parezca diseñada en vez de
recortada.

**Se recorta el marco blanco.** Muchas fichas traen el producto centrado con
muchísimo margen en blanco; sin quitarlo se desperdicia medio encuadre. El
umbral de recorte es conservador (6) para no morder piezas claras del propio
producto. Si la imagen va a sangre, `trim()` no encuentra borde uniforme y
devuelve la original, que es justo lo que se quiere.

**El texto va en una banda sólida abajo.** La primera versión lo ponía sobre un
degradado que se oscurecía hacia el pie, y el titular oscuro sobre fondo oscuro
no había quien lo leyera. Con una banda de color el contraste está garantizado
sea cual sea la foto. El pie va a la izquierda y el precio a la derecha, en la
misma fila: cuando iban uno debajo del otro, un titular de dos líneas los hacía
solaparse.

## Trampas que ya nos han mordido

**Las fuentes no son opcionales.** El texto se compone rasterizando un SVG. En
una imagen sin fuentes instaladas el texto sale en blanco **sin dar ningún
error**. El `Dockerfile` instala Noto (que cubre tildes y eñes) y refresca la
caché de fontconfig.

**No des por supuesto el tamaño tras `resize`.** Con `fit: "inside"` sharp
recalcula para conservar la proporción exacta y puede devolver un píxel menos
del pedido. Construir la máscara de esquinas con el tamaño *pedido* la hacía
mayor que la imagen y sharp abortaba con
`Image to composite must have same dimensions or smaller`. Solo saltaba cuando
la escala tocaba el tope, así que dos formatos de tres funcionaban. El tamaño se
lee de la imagen ya redimensionada.

**Al probar, manda el JSON desde un fichero.** Un `curl -d '{"titular":"Diseño"}'`
escrito directamente en el shell de Windows manda los acentos en la codificación
del terminal, no en UTF-8, y llegan como `U+FFFD`. Parece un problema de fuentes
y no lo es: se pierde un buen rato buscando donde no hay nada.

## Variables de entorno

- `PORT` (3001)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET` (`contenido`)

El bucket se crea solo la primera vez que se sube algo.
