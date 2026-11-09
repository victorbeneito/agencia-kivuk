import { readFile } from "fs/promises";
import path from "path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  euros,
  fecha,
  num,
  type DatosFiscales,
  type Factura,
  type LineaFactura,
} from "@/lib/facturacion";

/**
 * El PDF de la factura, generado con `pdf-lib`.
 *
 * Sin Puppeteer ni convertidores de HTML: son binarios de 300 MB que en Vercel
 * hay que empaquetar aparte y que fallan de formas raras. Aquí se dibuja el
 * documento a mano — es más código, pero son cuatro cajas y una tabla, y a
 * cambio funciona igual en local, en Vercel y en el VPS sin instalar nada.
 *
 * Las fuentes son las estándar del formato (Helvetica), que no se incrustan y
 * dejan el archivo en unos 5 KB. Su codificación es WinAnsi (Latin-1 ampliado):
 * los acentos y el símbolo del euro entran, pero cualquier carácter fuera de esa
 * tabla haría reventar la generación, así que todo el texto pasa antes por
 * `limpiar`.
 */

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 48;
const ANCHO_UTIL = A4.ancho - MARGEN * 2;

const TINTA = rgb(0.13, 0.13, 0.13);
const SUAVE = rgb(0.45, 0.45, 0.45);
const LINEA = rgb(0.85, 0.85, 0.85);
const BANDA = rgb(0.96, 0.96, 0.95);
// El azul de la marca (#8EB9C5), el mismo de las etiquetas del panel.
const MARCA = rgb(0.557, 0.725, 0.773);

// El logo de la cabecera es el mismo PNG que usan la web y el panel. Se lee de
// `public/` porque el Dockerfile copia esa carpeta junto al servidor standalone
// y el proceso arranca en ella, igual que `npm run dev` en local. Se guarda en
// memoria tras la primera lectura: el archivo no cambia mientras el servidor vive.
const RUTA_LOGO = path.join(process.cwd(), "public", "kivuk-logo.png");
const ALTO_LOGO = 42;
let logoEnMemoria: Promise<Uint8Array | null> | null = null;

/**
 * Los bytes del logo, o null si no está. Sin logo la factura sale igual: es
 * preferible una factura sin marca que ninguna factura.
 */
function bytesDelLogo(): Promise<Uint8Array | null> {
  logoEnMemoria ??= readFile(RUTA_LOGO).then(
    (b) => new Uint8Array(b),
    (error) => {
      console.error(`Factura sin logo: no se pudo leer ${RUTA_LOGO}`, error);
      logoEnMemoria = null; // que lo vuelva a intentar en la siguiente
      return null;
    }
  );
  return logoEnMemoria;
}

/** Sustituye lo que WinAnsi no sabe escribir por su equivalente más cercano. */
function limpiar(texto: string | null | undefined): string {
  return (texto ?? '')
    // El formateador de euros en español mete un espacio duro antes del €, y
    // hay espacios finos en los textos pegados desde un procesador de textos.
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    // Lo que quede fuera de WinAnsi haría fallar la generación entera, así que
    // se cae: es preferible una factura sin un signo raro que ninguna factura.
    .replace(/[^ -~¡-ÿ€–—]/g, '');
}

type Ctx = {
  pagina: PDFPage;
  normal: PDFFont;
  negrita: PDFFont;
  y: number;
};

function texto(
  ctx: Ctx,
  cadena: string,
  x: number,
  y: number,
  opciones: { size?: number; negrita?: boolean; color?: ReturnType<typeof rgb> } = {}
) {
  const size = opciones.size ?? 9.5;
  ctx.pagina.drawText(limpiar(cadena), {
    x,
    y,
    size,
    font: opciones.negrita ? ctx.negrita : ctx.normal,
    color: opciones.color ?? TINTA,
  });
}

function textoDerecha(
  ctx: Ctx,
  cadena: string,
  xDerecha: number,
  y: number,
  opciones: { size?: number; negrita?: boolean; color?: ReturnType<typeof rgb> } = {}
) {
  const size = opciones.size ?? 9.5;
  const font = opciones.negrita ? ctx.negrita : ctx.normal;
  const limpio = limpiar(cadena);
  const ancho = font.widthOfTextAtSize(limpio, size);
  texto(ctx, limpio, xDerecha - ancho, y, opciones);
}

/** Parte un texto en las líneas que caben en `ancho`. */
function partir(
  cadena: string,
  font: PDFFont,
  size: number,
  ancho: number
): string[] {
  const palabras = limpiar(cadena).split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) <= ancho) {
      actual = prueba;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Las líneas de una dirección, saltándose los campos vacíos. */
function direccionEn(d: DatosFiscales): string[] {
  // «46870 - Ontinyent (Valencia) España», saltándose lo que falte.
  const cp = [d.codigo_postal, d.ciudad].filter(Boolean).join(" - ");
  const provincia = d.provincia ? `(${d.provincia})` : "";
  return [
    d.direccion,
    [cp, provincia, d.pais].filter(Boolean).join(" "),
  ].filter((l) => l && l.trim());
}

export type DatosPdf = {
  factura: Factura;
  lineas: LineaFactura[];
  pieFactura?: string;
};

export async function generarPdfFactura({
  factura,
  lineas,
  pieFactura,
}: DatosPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([A4.ancho, A4.alto]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pagina, normal, negrita, y: A4.alto - MARGEN };

  const emisor = factura.emisor ?? ({} as DatosFiscales);
  const receptor = factura.receptor ?? ({} as DatosFiscales);
  const derecha = MARGEN + ANCHO_UTIL;

  doc.setTitle(`Factura ${factura.numero ?? "borrador"}`);
  doc.setProducer("Kivuk Agencia");

  // === Cabecera: logo y emisor a la izquierda, identificación de la factura a
  // la derecha
  let y = A4.alto - MARGEN;

  const logo = await bytesDelLogo();
  if (logo) {
    const imagen = await doc.embedPng(logo);
    const ancho = (imagen.width / imagen.height) * ALTO_LOGO;
    // El borde de arriba del logo, a la altura de las mayúsculas de «FACTURA».
    const arriba = A4.alto - MARGEN + 16;
    pagina.drawImage(imagen, {
      x: MARGEN,
      y: arriba - ALTO_LOGO,
      width: ancho,
      height: ALTO_LOGO,
    });
    y = arriba - ALTO_LOGO - 22;
  }

  texto(ctx, emisor.razon_social || "—", MARGEN, y, { size: 15, negrita: true });
  y -= 16;
  if (emisor.nif) {
    texto(ctx, `NIF ${emisor.nif}`, MARGEN, y, { size: 9, color: SUAVE });
    y -= 12;
  }
  for (const linea of direccionEn(emisor)) {
    texto(ctx, linea, MARGEN, y, { size: 9, color: SUAVE });
    y -= 12;
  }
  for (const contacto of [emisor.email, emisor.telefono, emisor.web].filter(Boolean)) {
    texto(ctx, contacto as string, MARGEN, y, { size: 9, color: SUAVE });
    y -= 12;
  }

  const yCabecera = A4.alto - MARGEN;
  textoDerecha(ctx, "FACTURA", derecha, yCabecera, { size: 22, negrita: true });

  // === Receptor: recuadro a la derecha, frente a los datos del emisor. Así las
  // dos partes se leen de un vistazo, cada una en su lado.
  const anchoCaja = 240;
  const relleno = 14;
  const xCaja = derecha - anchoCaja;
  const anchoTextoCaja = anchoCaja - relleno * 2 - 3;

  // Las líneas se calculan antes de dibujar: el alto del recuadro depende de
  // ellas, y el fondo tiene que pintarse debajo del texto.
  const filasCaja: { cadena: string; size: number; negrita?: boolean; color?: ReturnType<typeof rgb>; salto: number }[] = [
    { cadena: "FACTURAR A", size: 8, negrita: true, color: SUAVE, salto: 15 },
    ...partir(receptor.razon_social || "—", negrita, 11, anchoTextoCaja).map((l) => ({
      cadena: l,
      size: 11,
      negrita: true,
      salto: 14,
    })),
    ...[
      receptor.nif ? `NIF ${receptor.nif}` : "",
      ...direccionEn(receptor),
      receptor.email ?? "",
    ]
      .filter(Boolean)
      .flatMap((l) => partir(l, normal, 9, anchoTextoCaja))
      .map((l) => ({ cadena: l, size: 9, color: SUAVE, salto: 12 })),
  ];

  const arribaCaja = yCabecera - 26;
  const altoCaja = relleno + 8 + filasCaja.reduce((s, f) => s + f.salto, 0) + relleno - 12;
  pagina.drawRectangle({
    x: xCaja,
    y: arribaCaja - altoCaja,
    width: anchoCaja,
    height: altoCaja,
    color: BANDA,
  });
  pagina.drawRectangle({
    x: xCaja,
    y: arribaCaja - altoCaja,
    width: 3,
    height: altoCaja,
    color: MARCA,
  });

  let yCaja = arribaCaja - relleno - 8;
  for (const f of filasCaja) {
    texto(ctx, f.cadena, xCaja + 3 + relleno, yCaja, {
      size: f.size,
      negrita: f.negrita,
      color: f.color,
    });
    yCaja -= f.salto;
  }

  y = Math.min(y, arribaCaja - altoCaja) - 22;

  // === Identificación: número, fecha y, si lo hay, el periodo que cubre
  const datos: [string, string, boolean][] = [
    ["Nº DE FACTURA", factura.numero ?? "Borrador (sin numerar)", !!factura.numero],
    ["FECHA", fecha(factura.fecha_emision), true],
  ];
  if (factura.periodo_inicio && factura.periodo_fin) {
    datos.push([
      "PERIODO",
      `${fecha(factura.periodo_inicio)} – ${fecha(factura.periodo_fin)}`,
      true,
    ]);
  }

  datos.forEach(([rotulo, valor, fuerte], i) => {
    const x = MARGEN + i * 150;
    texto(ctx, rotulo, x, y, { size: 8, negrita: true, color: SUAVE });
    texto(ctx, valor, x, y - 15, {
      size: 11,
      negrita: true,
      color: fuerte ? TINTA : SUAVE,
    });
  });
  y -= 30;

  pagina.drawRectangle({
    x: MARGEN,
    y: y - 4,
    width: ANCHO_UTIL,
    height: 2,
    color: MARCA,
  });
  y -= 4;

  if (factura.concepto) {
    y -= 14;
    for (const linea of partir(factura.concepto, negrita, 9.5, ANCHO_UTIL)) {
      texto(ctx, linea, MARGEN, y, { size: 9.5, negrita: true });
      y -= 13;
    }
  }

  y -= 22;

  // === Tabla de líneas
  // Bordes derechos de cada columna numérica. El importe necesita sitio para
  // «10.000,00 €» en negrita sin pisar el precio, y el precio lo mismo con la
  // cantidad: con menos de ~80 puntos entre bordes, las cifras se tocan.
  const xImporte = derecha;
  const xPrecioDer = derecha - 90;
  const xCantidadDer = derecha - 170;
  const anchoConcepto = xCantidadDer - 40 - (MARGEN + 6);

  pagina.drawRectangle({
    x: MARGEN,
    y: y - 5,
    width: ANCHO_UTIL,
    height: 20,
    color: BANDA,
  });
  texto(ctx, "CONCEPTO", MARGEN + 6, y, { size: 8, negrita: true, color: SUAVE });
  textoDerecha(ctx, "CANT.", xCantidadDer, y, { size: 8, negrita: true, color: SUAVE });
  textoDerecha(ctx, "PRECIO", xPrecioDer, y, { size: 8, negrita: true, color: SUAVE });
  textoDerecha(ctx, "IMPORTE", xImporte, y, { size: 8, negrita: true, color: SUAVE });
  y -= 24;

  for (const linea of [...lineas].sort((a, b) => a.posicion - b.posicion)) {
    const importe = num(linea.cantidad) * num(linea.precio);
    const titulo = partir(linea.concepto, negrita, 9.5, anchoConcepto);
    const detalle = linea.descripcion
      ? partir(linea.descripcion, normal, 8.5, anchoConcepto)
      : [];

    texto(ctx, titulo[0] ?? "", MARGEN + 6, y, { negrita: true });
    textoDerecha(ctx, String(num(linea.cantidad)), xCantidadDer, y);
    textoDerecha(ctx, euros(num(linea.precio)), xPrecioDer, y);
    textoDerecha(ctx, euros(importe), xImporte, y, { negrita: true });

    let yLinea = y - 12;
    for (const resto of titulo.slice(1)) {
      texto(ctx, resto, MARGEN + 6, yLinea, { negrita: true });
      yLinea -= 12;
    }
    for (const d of detalle) {
      texto(ctx, d, MARGEN + 6, yLinea, { size: 8.5, color: SUAVE });
      yLinea -= 11;
    }

    y = yLinea - 6;
    pagina.drawRectangle({
      x: MARGEN,
      y: y + 4,
      width: ANCHO_UTIL,
      height: 0.5,
      color: LINEA,
    });
    y -= 10;
  }

  // === Totales
  y -= 6;
  const xRotulo = derecha - 200;

  const filas: [string, string, boolean][] = [
    ["Base imponible", euros(factura.base), false],
    [`IVA ${num(factura.iva_pct)}%`, euros(factura.iva), false],
  ];
  if (num(factura.irpf_pct) > 0) {
    filas.push([`Retención IRPF ${num(factura.irpf_pct)}%`, `-${euros(factura.irpf)}`, false]);
  }

  for (const [rotulo, valor] of filas) {
    texto(ctx, rotulo, xRotulo, y, { size: 9.5, color: SUAVE });
    textoDerecha(ctx, valor, derecha, y, { size: 9.5 });
    y -= 15;
  }

  // Aire entre la última fila y la franja del total: sin él, la franja se
  // dibujaba encima de la retención y la tapaba.
  y -= 10;

  pagina.drawRectangle({
    x: xRotulo - 10,
    y: y - 9,
    width: derecha - xRotulo + 10,
    height: 25,
    color: BANDA,
  });
  texto(ctx, "TOTAL", xRotulo, y, { size: 11, negrita: true });
  textoDerecha(ctx, euros(factura.total), derecha, y, { size: 13, negrita: true });
  y -= 40;

  // === Cómo se paga
  const formaPago =
    {
      transferencia: "Transferencia bancaria",
      domiciliacion: "Domiciliación bancaria",
      tarjeta: "Tarjeta / enlace de pago",
      efectivo: "Efectivo",
      otro: "Otra",
    }[factura.forma_pago] ?? factura.forma_pago;

  texto(ctx, "FORMA DE PAGO", MARGEN, y, { size: 8, negrita: true, color: SUAVE });
  y -= 14;
  texto(ctx, formaPago, MARGEN, y, { size: 9.5 });
  y -= 13;

  // Domiciliada, el IBAN de la agencia no pinta nada: invitaría a transferir
  // lo que ya se va a cargar. Se dice en qué cuenta se carga, si se sabe.
  const domiciliada = factura.forma_pago === "domiciliacion";
  if (domiciliada) {
    texto(
      ctx,
      receptor.cuenta_cargo
        ? `Se cargará en la cuenta ${receptor.cuenta_cargo} del cliente, según la orden de domiciliación firmada.`
        : "Se cargará en la cuenta del cliente, según la orden de domiciliación firmada.",
      MARGEN,
      y,
      { size: 9, color: SUAVE }
    );
    y -= 13;
  } else if (emisor.iban) {
    texto(ctx, `IBAN: ${emisor.iban}`, MARGEN, y, { size: 9.5 });
    y -= 13;
  }
  if (factura.fecha_vencimiento) {
    texto(ctx, `Vencimiento: ${fecha(factura.fecha_vencimiento)}`, MARGEN, y, {
      size: 9.5,
      negrita: true,
    });
    y -= 13;
  }
  if (factura.enlace_pago) {
    texto(ctx, `Pago con tarjeta: ${factura.enlace_pago}`, MARGEN, y, {
      size: 9,
      color: SUAVE,
    });
    y -= 13;
  }
  if (factura.numero && !domiciliada) {
    texto(ctx, `Indica la referencia ${factura.numero} en el concepto.`, MARGEN, y, {
      size: 9,
      color: SUAVE,
    });
    y -= 13;
  }

  // === Notas y pie
  if (factura.notas) {
    y -= 10;
    for (const linea of partir(factura.notas, normal, 9, ANCHO_UTIL)) {
      texto(ctx, linea, MARGEN, y, { size: 9, color: SUAVE });
      y -= 12;
    }
  }

  if (pieFactura) {
    // El pie se ancla abajo, no al hilo del contenido: es el mismo texto legal
    // en todas las facturas y queda raro flotando a media página.
    const lineasPie = partir(pieFactura, normal, 7.5, ANCHO_UTIL);
    let yPie = MARGEN + lineasPie.length * 10;

    pagina.drawRectangle({
      x: MARGEN,
      y: yPie + 12,
      width: ANCHO_UTIL,
      height: 0.5,
      color: LINEA,
    });

    for (const linea of lineasPie) {
      texto(ctx, linea, MARGEN, yPie, { size: 7.5, color: SUAVE });
      yPie -= 10;
    }
  }

  return doc.save();
}
