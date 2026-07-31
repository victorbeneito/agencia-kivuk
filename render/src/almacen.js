/**
 * Subida a Supabase Storage.
 *
 * Instagram no acepta que le mandes los bytes de una foto: descarga el medio de
 * una URL pública. Por eso todo lo que se renderiza acaba en un bucket público
 * y lo que viaja después es solo el enlace.
 */

const URL_BASE = process.env.SUPABASE_URL || "";
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "contenido";

export const almacenConfigurado = () => Boolean(URL_BASE && CLAVE);

/** Crea el bucket público si no existe. Idempotente. */
export async function asegurarBucket() {
  if (!almacenConfigurado()) return { ok: false, motivo: "sin_credenciales" };

  const res = await fetch(`${URL_BASE}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${CLAVE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });

  // 409 = ya existe, que es el caso normal a partir de la segunda vez.
  if (res.ok || res.status === 409) return { ok: true };

  return { ok: false, motivo: `${res.status} ${await res.text()}` };
}

/**
 * @param {string} ruta   p. ej. "25fb4723.../post-abc.jpg"
 * @param {Buffer} datos
 * @param {string} tipo   content-type
 * @returns {Promise<string>} URL pública
 */
export async function subir(ruta, datos, tipo) {
  if (!almacenConfigurado()) throw new Error("Supabase Storage no está configurado");

  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${CLAVE}`,
      "Content-Type": tipo,
      // Que una segunda pasada pueda reemplazar el fichero en vez de fallar.
      "x-upsert": "true",
    },
    body: datos,
  });

  if (!res.ok) {
    throw new Error(`No se pudo subir a Storage: ${res.status} ${await res.text()}`);
  }

  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${ruta}`;
}
