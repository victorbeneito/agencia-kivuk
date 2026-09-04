/**
 * Datos públicos de la agencia.
 *
 * Todo lo que la web enseña de Kivuk —el correo, el WhatsApp, el aviso legal—
 * sale de aquí, para que cambiar un dato sea tocar un sitio y no doce. No es
 * configuración por cliente: esto es la agencia hablando de sí misma, así que va
 * en código y no en base de datos.
 *
 * Los datos fiscales están vacíos a propósito: la ley obliga a publicarlos
 * (art. 10 LSSI) y no me los puedo inventar. Mientras estén en blanco, el aviso
 * legal marca el hueco en vez de fingir que está completo.
 */
export const KIVUK = {
  nombre: "Kivuk Agencia",
  dominio: "agenciakivuk.com",
  web: "https://agenciakivuk.com",
  panel: "https://panel.agenciakivuk.com",
  email: "info@agenciakivuk.com",
  /** Handle de Instagram sin la arroba. Vacío = no se enseña el enlace. */
  instagram: "",

  /** Identificación del titular para el aviso legal y la política de privacidad. */
  fiscal: {
    titular: "Víctor Beneito Lluch",
    nif: "52.717.119-S",
    domicilio: "Partida La Solana, 30-87, 46870 Ontinyent (València)",
  },
} as const;

/**
 * El número de WhatsApp de la agencia, en dígitos con prefijo de país.
 *
 * Vive en el entorno y no aquí porque el bot propio de Kivuk todavía no está
 * montado (es el punto 1 de `docs/marketing-y-captacion.md`). Mientras la
 * variable esté vacía, los botones de WhatsApp se caen solos al formulario de
 * contacto; el día que exista el número, se rellena la variable y la web pasa a
 * ser la demostración sin tocar una línea de código.
 *
 * Se lee `process.env.NEXT_PUBLIC_...` literal a propósito: Next sustituye estas
 * variables en tiempo de compilación buscando el texto exacto, así que una
 * lectura dinámica se quedaría en `undefined` en el navegador.
 */
const NUMERO_BRUTO = process.env.NEXT_PUBLIC_KIVUK_WHATSAPP ?? "";

/** Solo dígitos: `wa.me` no admite espacios, guiones ni el `+`. */
const NUMERO = NUMERO_BRUTO.replace(/\D/g, "");

export const hayWhatsApp = NUMERO.length >= 8;

/**
 * Enlace a la conversación con el bot de la agencia.
 *
 * El mensaje precargado cambia según el botón que se pulse: no es adorno, es la
 * única forma de saber desde dónde ha llegado alguien cuando el primer contacto
 * es un WhatsApp y no una visita con parámetros en la URL.
 *
 * Devuelve `null` si no hay número configurado, para que quien lo use decida
 * qué enseñar en su lugar.
 */
export function enlaceWhatsApp(mensaje: string): string | null {
  if (!hayWhatsApp) return null;
  return `https://wa.me/${NUMERO}?text=${encodeURIComponent(mensaje)}`;
}

/** El mismo enlace, o el ancla del formulario si todavía no hay número. */
export function enlaceContacto(mensaje: string): string {
  return enlaceWhatsApp(mensaje) ?? "#contacto";
}

/** Número en formato legible para enseñarlo escrito (+34 600 00 00 00). */
export function numeroLegible(): string | null {
  if (!hayWhatsApp) return null;
  const nacional = NUMERO.slice(2);
  const grupos = nacional.match(/^(\d{3})(\d{2})(\d{2})(\d{2})$/);
  return grupos
    ? `+${NUMERO.slice(0, 2)} ${grupos.slice(1).join(" ")}`
    : `+${NUMERO}`;
}
