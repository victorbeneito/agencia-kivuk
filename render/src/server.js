import express from "express";
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

app.get("/marca-por-defecto", (_req, res) => res.json(MARCA_POR_DEFECTO));

app.listen(PUERTO, () => {
  console.log(`Render escuchando en :${PUERTO}`);
});
