import express from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import {
  componerImagen,
  formatearPrecio,
  FORMATOS,
  MARCA_POR_DEFECTO,
} from "./plantillas.js";
import { almacenConfigurado, asegurarBucket, subir } from "./almacen.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PUERTO = Number(process.env.PORT || 3001);

/** Descarga la foto del producto. */
async function descargar(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "KivukRender/0.1" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`La foto respondió ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

app.get("/salud", (_req, res) => {
  res.json({
    ok: true,
    formatos: Object.keys(FORMATOS),
    almacen: almacenConfigurado(),
  });
});

/**
 * POST /imagen
 * {
 *   "client_id": "...",
 *   "formato": "post" | "story" | "cuadrado",
 *   "titular": "Zen para tu ventana",
 *   "pie": "@hogardetusuenos",
 *   "producto": { "image_url": "...", "price": 55.15, "currency": "EUR" },
 *   "marca": { "primario": "#6D9AAC", "secundario": "#CEB38D" },
 *   "subir": true
 * }
 *
 * Con `subir: false` devuelve el JPEG en crudo, que es lo cómodo para mirar el
 * resultado mientras se ajusta la plantilla.
 */
app.post("/imagen", async (req, res) => {
  try {
    const {
      client_id: clientId = "",
      formato = "post",
      estilo = "banda",
      titular = "",
      pie = "",
      etiqueta = "",
      producto = {},
      marca = {},
      subir: quiereSubir = true,
    } = req.body || {};

    if (!producto.image_url) {
      return res.status(400).json({ ok: false, error: "Falta producto.image_url" });
    }
    if (!FORMATOS[formato]) {
      return res
        .status(400)
        .json({ ok: false, error: `Formato desconocido: ${formato}` });
    }

    const imagen = await descargar(producto.image_url);

    const pieza = await componerImagen({
      formato,
      estilo,
      imagen,
      titular,
      precio: formatearPrecio(producto.price, producto.currency),
      pie,
      etiqueta,
      marca,
    });

    if (!quiereSubir || !almacenConfigurado()) {
      res.set("Content-Type", "image/jpeg");
      return res.send(pieza.buffer);
    }

    await asegurarBucket();
    const ruta = `${clientId || "sin-cliente"}/${formato}-${randomUUID()}.jpg`;
    const url = await subir(ruta, pieza.buffer, "image/jpeg");

    res.json({
      ok: true,
      url,
      formato,
      estilo: pieza.estilo,
      ancho: pieza.ancho,
      alto: pieza.alto,
      bytes: pieza.buffer.length,
    });
  } catch (e) {
    // El error viaja en el cuerpo: quien llama es un workflow, no una persona
    // mirando logs.
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * POST /subir?client_id=...&formato=post
 * Cuerpo: los bytes de la imagen, tal cual.
 *
 * Para piezas hechas fuera (Pomelli, Canva, un diseñador) que quieren entrar en
 * la misma cola de revisión y publicación. No se compone nada: solo se
 * comprueba que Instagram vaya a aceptarla y se deja en el bucket.
 *
 * Se convierte SIEMPRE a JPEG: Instagram no admite PNG, y las exportaciones de
 * las herramientas de diseño suelen serlo. Fallar aquí con un mensaje claro es
 * mejor que fallar al publicar, cuando ya se ha aprobado.
 */

/** Límites de Instagram para el ancho y la proporción. */
const ANCHO_MAXIMO = 1440;
const PROPORCION = {
  // Feed: de 4:5 (0,8) a 1,91:1. Fuera de ahí Instagram rechaza el contenedor.
  post: { min: 0.8, max: 1.91, nombre: "entre 4:5 y 1,91:1" },
  // Las stories son 9:16 (0,5625); se admite hasta cuadrado, que Instagram
  // encaja añadiendo fondo.
  story: { min: 0.5, max: 1.0, nombre: "entre 9:16 y 1:1" },
  cuadrado: { min: 0.9, max: 1.11, nombre: "cuadrada" },
};

app.post("/subir", express.raw({ type: "*/*", limit: "12mb" }), async (req, res) => {
  try {
    const clientId = String(req.query.client_id || "").trim();
    const formato = String(req.query.formato || "post");

    const limites = PROPORCION[formato];
    if (!limites) {
      return res.status(400).json({ ok: false, error: `Formato desconocido: ${formato}` });
    }
    if (!req.body || !req.body.length) {
      return res.status(400).json({ ok: false, error: "No ha llegado ninguna imagen" });
    }

    let meta;
    try {
      meta = await sharp(req.body).metadata();
    } catch {
      return res
        .status(400)
        .json({ ok: false, error: "Eso no parece una imagen que se pueda leer" });
    }

    const proporcion = meta.width / meta.height;
    if (proporcion < limites.min || proporcion > limites.max) {
      return res.status(400).json({
        ok: false,
        error:
          `La imagen es de ${meta.width}×${meta.height} (proporción ${proporcion.toFixed(2)}) ` +
          `e Instagram la rechazaría: para «${formato}» tiene que ser ${limites.nombre}.`,
      });
    }

    // Se recorta el ancho pero nunca se amplía: agrandar una imagen ya
    // terminada solo la emborrona.
    let img = sharp(req.body).rotate();
    if (meta.width > ANCHO_MAXIMO) img = img.resize({ width: ANCHO_MAXIMO });

    const jpeg = await img.jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    const final = await sharp(jpeg).metadata();

    if (!almacenConfigurado()) {
      return res.status(500).json({ ok: false, error: "Supabase Storage no está configurado" });
    }

    await asegurarBucket();
    const ruta = `${clientId || "sin-cliente"}/subida-${randomUUID()}.jpg`;
    const url = await subir(ruta, jpeg, "image/jpeg");

    res.json({
      ok: true,
      url,
      formato,
      ancho: final.width,
      alto: final.height,
      bytes: jpeg.length,
      convertida: meta.format !== "jpeg",
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get("/marca-por-defecto", (_req, res) => res.json(MARCA_POR_DEFECTO));

app.listen(PUERTO, () => {
  console.log(`Render escuchando en :${PUERTO}`);
});
