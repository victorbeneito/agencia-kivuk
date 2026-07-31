import sharp from "sharp";

/**
 * Composición de las piezas fijas (post, story, cuadrado).
 *
 * La foto del producto NO se reescala hacia arriba: las tiendas suelen servir
 * como mucho 800 px y estirarlas a 1080 se nota. En vez de eso el producto va a
 * su tamaño real sobre un lienzo de 1080 con fondo de marca, que además queda
 * con aspecto de pieza diseñada en lugar de foto recortada.
 */

export const FORMATOS = {
  post: { ancho: 1080, alto: 1350 },
  story: { ancho: 1080, alto: 1920 },
  cuadrado: { ancho: 1080, alto: 1080 },
};

export const MARCA_POR_DEFECTO = {
  primario: "#6D9AAC",
  secundario: "#CEB38D",
  fondo: "#F1F5F6",
  texto: "#2E4550",
};

const FUENTE = "Noto Sans, DejaVu Sans, sans-serif";

const escapar = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Reparte el texto en líneas que quepan en `maxAncho`. Se estima el ancho por
 * número de caracteres (~0,52 del cuerpo en Noto Sans); no es tipografía fina,
 * pero evita tener que cargar métricas de fuente solo para partir un titular.
 */
export function envolver(texto, maxAncho, tamano, maxLineas = 3) {
  const porLinea = Math.max(8, Math.floor(maxAncho / (tamano * 0.52)));
  const lineas = [];
  let actual = "";

  for (const palabra of String(texto ?? "").trim().split(/\s+/).filter(Boolean)) {
    const probar = actual ? `${actual} ${palabra}` : palabra;
    if (probar.length <= porLinea) {
      actual = probar;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);

  if (lineas.length > maxLineas) {
    const cortadas = lineas.slice(0, maxLineas);
    cortadas[maxLineas - 1] = cortadas[maxLineas - 1].replace(/[.,;:]?$/, "…");
    return cortadas;
  }
  return lineas;
}

/** Precio en formato español: 55,15 € */
export function formatearPrecio(precio, moneda = "EUR") {
  if (precio === null || precio === undefined || precio === "") return "";
  const n = Number(precio);
  if (!Number.isFinite(n)) return "";
  const simbolo = moneda === "EUR" ? "€" : escapar(moneda);
  return `${n.toFixed(2).replace(".", ",")} ${simbolo}`;
}

/**
 * Quita el marco blanco de estudio. Importa: muchas fichas traen el producto
 * centrado con muchísimo margen en blanco, y sin quitarlo se desperdicia medio
 * encuadre. Umbral conservador para no morder piezas
 * claras del propio producto; si la imagen va a sangre, `trim()` no encuentra
 * borde uniforme y devuelve la original, que es justo lo que queremos.
 */
export async function recortarBlanco(buffer) {
  const base = sharp(buffer).rotate();
  try {
    return await base.clone().trim({ threshold: 6 }).toBuffer();
  } catch {
    return await base.clone().toBuffer();
  }
}

async function prepararProducto(buffer, maxAncho, maxAlto) {
  const recortada = await recortarBlanco(buffer);
  const meta = await sharp(recortada).metadata();
  // Se permite ampliar un poco, pero no lo que haga falta: las tiendas sirven
  // como mucho 800 px y estirar eso a 1080 (1,35x) no se aprecia, mientras que
  // dejarlo a tamaño nativo deja el producto pequeño y perdido en el lienzo.
  // Más allá de ~1,45x sí empieza a verse blando.
  const escala = Math.min(maxAncho / meta.width, maxAlto / meta.height, 1.45);
  const ancho = Math.max(1, Math.round(meta.width * escala));
  const alto = Math.max(1, Math.round(meta.height * escala));

  const redimensionada = await sharp(recortada)
    .resize(ancho, alto, { fit: "inside" })
    .toBuffer();

  // El tamaño real se lee de la imagen, no se da por supuesto: con fit:"inside"
  // sharp recalcula para conservar la proporción exacta y puede devolver un
  // píxel menos de lo pedido. Construir la máscara con el tamaño pedido hacía
  // que fuese mayor que la imagen y sharp abortaba el composite.
  const real = await sharp(redimensionada).metadata();

  // Esquinas redondeadas con una máscara: dest-in conserva el píxel de la
  // imagen solo donde la máscara es opaca.
  const radio = Math.round(Math.min(real.width, real.height) * 0.035);
  const mascara = Buffer.from(
    `<svg width="${real.width}" height="${real.height}"><rect width="${real.width}" height="${real.height}" rx="${radio}" ry="${radio}" fill="#fff"/></svg>`
  );

  const conEsquinas = await sharp(redimensionada)
    .composite([{ input: mascara, blend: "dest-in" }])
    .png()
    .toBuffer();

  return { buffer: conEsquinas, ancho: real.width, alto: real.height };
}

/**
 * Lienzo completo: fondo claro arriba (donde va el producto) y banda sólida de
 * color de marca abajo con el texto en blanco.
 *
 * La banda no es un capricho: la primera versión ponía el texto sobre un
 * degradado que se oscurecía, y el titular oscuro sobre fondo oscuro no se leía.
 * Con una banda sólida el contraste está garantizado sea cual sea la foto.
 */
function lienzoSvg({ ancho, alto, banda, titular, precio, pie, marca, margen, invertido }) {
  const yBanda = alto - banda;

  // Invertido: fondo de color y banda clara. Es el mismo esquema con los
  // colores al revés, y en la cuadrícula del perfil se distingue de un vistazo
  // sin salirse de la identidad de marca.
  const colorFondo = invertido ? marca.primario : marca.fondo;
  const colorBanda = invertido ? marca.fondo : marca.primario;
  const colorTexto = invertido ? marca.texto : "#FFFFFF";

  const cuerpo = alto >= 1900 ? 72 : 62;
  const lineas = envolver(titular, ancho - margen * 2, cuerpo, 2);
  const altoLinea = Math.round(cuerpo * 1.2);

  const yTitular = yBanda + Math.round(banda * 0.34);

  const titularSvg = lineas
    .map(
      (linea, i) =>
        `<text x="${margen}" y="${yTitular + i * altoLinea}" font-family="${FUENTE}" font-size="${cuerpo}" font-weight="700" fill="${colorTexto}">${escapar(linea)}</text>`
    )
    .join("\n  ");

  // Fila de abajo: el pie a la izquierda y el precio a la derecha. Antes iban
  // uno debajo del otro y con dos líneas de titular se solapaban.
  const yCentroFila = alto - Math.round(margen * 0.85);

  // Píldora dorada para el precio: el dorado sobre el azul apagado tiene poco
  // contraste como texto, pero como fondo con texto oscuro encima funciona.
  let precioSvg = "";
  let xPildora = ancho - margen;
  if (precio) {
    const cuerpoPrecio = 46;
    const padX = 32;
    const anchoPildora = Math.round(precio.length * cuerpoPrecio * 0.6) + padX * 2;
    const altoPildora = Math.round(cuerpoPrecio * 1.7);
    xPildora = ancho - margen - anchoPildora;
    const yPildora = yCentroFila - Math.round(altoPildora / 2);

    precioSvg = `<rect x="${xPildora}" y="${yPildora}" width="${anchoPildora}" height="${altoPildora}" rx="${Math.round(altoPildora / 2)}" fill="${marca.secundario}"/>
  <text x="${xPildora + padX}" y="${yPildora + Math.round(altoPildora * 0.68)}" font-family="${FUENTE}" font-size="${cuerpoPrecio}" font-weight="700" fill="${marca.texto}">${escapar(precio)}</text>`;
  }

  // El pie se recorta a lo que quede libre antes de la píldora. Con un handle y
  // un dominio largos llegaba a meterse debajo del precio.
  const cuerpoPie = 32;
  const anchoPie = xPildora - margen - 28;
  const maxPie = Math.max(6, Math.floor(anchoPie / (cuerpoPie * 0.52)));
  const pieCortado =
    pie.length > maxPie
      ? // Se quita la puntuación del corte para no acabar en "dominio...."
        pie.slice(0, maxPie - 1).replace(/[\s.,;:·-]+$/, "") + "…"
      : pie;

  const pieSvg = pie
    ? `<text x="${margen}" y="${yCentroFila + 11}" font-family="${FUENTE}" font-size="${cuerpoPie}" fill="${colorTexto}" opacity="0.85">${escapar(pieCortado)}</text>`
    : "";

  return Buffer.from(`<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${ancho}" height="${alto}" fill="${colorFondo}"/>
  <rect x="0" y="${yBanda}" width="${ancho}" height="${banda}" fill="${colorBanda}"/>
  ${titularSvg}
  ${precioSvg}
  ${pieSvg}
</svg>`);
}

/**
 * Estilo «a sangre»: la foto ocupa todo el lienzo y el texto va encima, sobre
 * un degradado oscuro que solo cubre la parte de abajo.
 *
 * Funciona muy bien con los estampados, que son imágenes de verdad (paisajes,
 * ciudades, dibujos) y no fotos de estudio: recortadas a pantalla completa se
 * ven como una foto, no como una ficha de producto.
 */
function capaSangre({ ancho, alto, titular, precio, pie, marca, margen }) {
  const cuerpo = alto >= 1900 ? 78 : 68;
  const lineas = envolver(titular, ancho - margen * 2, cuerpo, 2);
  const altoLinea = Math.round(cuerpo * 1.2);

  const yCentroFila = alto - Math.round(margen * 0.85);
  const yTitular = yCentroFila - 110 - (lineas.length - 1) * altoLinea;

  const titularSvg = lineas
    .map(
      (linea, i) =>
        `<text x="${margen}" y="${yTitular + i * altoLinea}" font-family="${FUENTE}" font-size="${cuerpo}" font-weight="700" fill="#FFFFFF">${escapar(linea)}</text>`
    )
    .join("\n  ");

  let precioSvg = "";
  let xPildora = ancho - margen;
  if (precio) {
    const cuerpoPrecio = 46;
    const padX = 32;
    const anchoPildora = Math.round(precio.length * cuerpoPrecio * 0.6) + padX * 2;
    const altoPildora = Math.round(cuerpoPrecio * 1.7);
    xPildora = ancho - margen - anchoPildora;
    const yPildora = yCentroFila - Math.round(altoPildora / 2);
    precioSvg = `<rect x="${xPildora}" y="${yPildora}" width="${anchoPildora}" height="${altoPildora}" rx="${Math.round(altoPildora / 2)}" fill="${marca.secundario}"/>
  <text x="${xPildora + padX}" y="${yPildora + Math.round(altoPildora * 0.68)}" font-family="${FUENTE}" font-size="${cuerpoPrecio}" font-weight="700" fill="${marca.texto}">${escapar(precio)}</text>`;
  }

  const maxPie = Math.max(6, Math.floor((xPildora - margen - 28) / (32 * 0.52)));
  const pieCortado =
    pie.length > maxPie
      ? pie.slice(0, maxPie - 1).replace(/[\s.,;:·-]+$/, "") + "…"
      : pie;

  // El degradado arranca a media altura: sin él, un estampado claro deja el
  // texto blanco ilegible, y opacando toda la foto se pierde el producto.
  return Buffer.from(`<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="${ancho}" height="${alto}" fill="url(#s)"/>
  ${titularSvg}
  ${precioSvg}
  ${pie ? `<text x="${margen}" y="${yCentroFila + 11}" font-family="${FUENTE}" font-size="32" fill="#FFFFFF" opacity="0.9">${escapar(pieCortado)}</text>` : ""}
</svg>`);
}

/**
 * Etiqueta con el tipo de producto, arriba a la izquierda.
 *
 * No es decoración: sin ella, un estampado de paisaje a pantalla completa se ve
 * precioso y nadie sabe que lo que se vende es un estor a medida. El hashtag no
 * basta, porque casi nadie los lee.
 */
function etiquetaSvg({ ancho, texto, marca, margen, sobreFoto }) {
  if (!texto) return null;

  const cuerpo = 30;
  const padX = 24;
  const alto = 54;
  const anchoCaja = Math.min(
    Math.round(texto.length * cuerpo * 0.58) + padX * 2,
    ancho - margen * 2
  );

  // Sobre foto hace falta una base opaca; sobre el fondo de marca basta con el
  // color de acento, que además ata la pieza a la identidad.
  const fondo = sobreFoto ? "#FFFFFF" : marca.primario;
  const tinta = sobreFoto ? marca.texto : "#FFFFFF";

  return {
    svg: Buffer.from(`<svg width="${anchoCaja}" height="${alto}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${anchoCaja}" height="${alto}" rx="${Math.round(alto / 2)}" fill="${fondo}" fill-opacity="${sobreFoto ? 0.92 : 1}"/>
  <text x="${padX}" y="${Math.round(alto * 0.66)}" font-family="${FUENTE}" font-size="${cuerpo}" font-weight="600" fill="${tinta}">${escapar(texto)}</text>
</svg>`),
    ancho: anchoCaja,
    alto,
  };
}

/** Estilos disponibles. Rotarlos es lo que evita que el perfil parezca un bot. */
export const ESTILOS = ["banda", "sangre", "marco"];

/**
 * Compone una pieza fija.
 *
 * @param {object} opciones
 * @param {"post"|"story"|"cuadrado"} opciones.formato
 * @param {"banda"|"sangre"|"marco"} [opciones.estilo]
 * @param {Buffer} opciones.imagen  foto del producto ya descargada
 * @param {string} opciones.titular
 * @param {string} [opciones.precio]  ya formateado
 * @param {string} [opciones.pie]     handle de la cuenta, web...
 * @param {object} [opciones.marca]
 * @returns {Promise<{buffer: Buffer, ancho: number, alto: number, estilo: string}>}
 */
export async function componerImagen({
  formato = "post",
  estilo = "banda",
  imagen,
  titular = "",
  precio = "",
  pie = "",
  etiqueta = "",
  marca: marcaParcial = {},
}) {
  const dim = FORMATOS[formato];
  if (!dim) throw new Error(`Formato desconocido: ${formato}`);
  if (!imagen || !imagen.length) throw new Error("Falta la imagen del producto");
  if (!ESTILOS.includes(estilo)) estilo = "banda";

  const marca = { ...MARCA_POR_DEFECTO, ...marcaParcial };
  const { ancho, alto } = dim;
  const margen = Math.round(ancho * 0.07);

  if (estilo === "sangre") {
    // Se recorta el marco blanco antes de llenar el lienzo: si no, el "a
    // sangre" acaba siendo un rectángulo blanco con el producto en medio.
    const limpia = await recortarBlanco(imagen);
    const fondo = await sharp(limpia)
      .resize(ancho, alto, { fit: "cover", position: "attention" })
      .toBuffer();

    const chip = etiquetaSvg({ ancho, texto: etiqueta, marca, margen, sobreFoto: true });

    const buffer = await sharp(fondo)
      .composite([
        { input: capaSangre({ ancho, alto, titular, precio, pie, marca, margen }), left: 0, top: 0 },
        ...(chip ? [{ input: chip.svg, left: margen, top: margen }] : []),
      ])
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();

    return { buffer, ancho, alto, estilo };
  }

  // "marco": mismo esquema que "banda" con los colores invertidos y el producto
  // algo más pequeño. Entre dos piezas llenas descansa la vista, y en la
  // cuadrícula del perfil rompe la sensación de plantilla repetida.
  const esMarco = estilo === "marco";
  const banda = { post: 350, story: 440, cuadrado: 330 }[formato];
  const zonaAlto = alto - banda;
  const holgura = esMarco ? 1.35 : 1;

  const chip = etiquetaSvg({
    ancho,
    texto: etiqueta,
    marca,
    margen,
    // En "marco" el fondo ya es el color de marca, así que la etiqueta va en
    // blanco para que no desaparezca sobre él.
    sobreFoto: esMarco,
  });
  const altoChip = chip ? chip.alto + Math.round(margen * 0.5) : 0;

  const producto = await prepararProducto(
    imagen,
    Math.round((ancho - margen * 2) / holgura),
    Math.round((zonaAlto - margen * 2 - altoChip) / holgura)
  );

  const left = Math.round((ancho - producto.ancho) / 2);
  // Se centra en el espacio que queda bajo la etiqueta, no en toda la zona: si
  // no, el producto se le mete debajo.
  const top = altoChip + Math.round((zonaAlto - altoChip - producto.alto) / 2);

  const buffer = await sharp(
    lienzoSvg({
      ancho, alto, banda, titular, precio, pie, marca, margen,
      invertido: esMarco,
    })
  )
    .composite([
      { input: producto.buffer, left, top },
      ...(chip ? [{ input: chip.svg, left: margen, top: margen }] : []),
    ])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return { buffer, ancho, alto, estilo };
}
