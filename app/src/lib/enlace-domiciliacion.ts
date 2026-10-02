import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace para domiciliar que se puede mandar por correo o por WhatsApp.
 *
 * La página de Stripe (Checkout) caduca a las 24 horas, y un correo se lee
 * cuando se lee. Por eso lo que se manda no es la página de Stripe sino
 * `/domiciliar/<token>`, una dirección del panel que crea la sesión de Stripe
 * en el momento en que el cliente pulsa. El token dice de qué cliente es y
 * hasta cuándo vale, firmado para que nadie pueda fabricar el de otro cliente
 * cambiando el id.
 *
 * Sin tabla ni migración: la firma es un HMAC con la clave de Stripe, que ya
 * es un secreto de servidor. Si un día se cambia esa clave, los enlaces que
 * estén por ahí dejan de valer y hay que mandar otros.
 */

export const DIAS_VALIDEZ_ENLACE = 30;

function firmar(texto: string): string {
  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave) throw new Error("Falta STRIPE_SECRET_KEY en el entorno del panel.");
  return createHmac("sha256", `domiciliacion:${clave}`).update(texto).digest("base64url");
}

/** `clientId.caducidad.firma`, con la caducidad en segundos Unix. */
export function crearToken(clientId: string, dias = DIAS_VALIDEZ_ENLACE): string {
  const caduca = Math.floor(Date.now() / 1000) + dias * 86_400;
  const cuerpo = `${clientId}.${caduca}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

/** El cliente del token si la firma cuadra y no ha caducado; si no, null. */
export function leerToken(token: string): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  const [clientId, caduca, firma] = partes;
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !/^\d+$/.test(caduca)) return null;

  let esperada: Buffer;
  try {
    esperada = Buffer.from(firmar(`${clientId}.${caduca}`));
  } catch {
    return null;
  }
  const recibida = Buffer.from(firma);
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;

  if (Number(caduca) < Date.now() / 1000) return null;
  return clientId;
}
