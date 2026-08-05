/** Lo que la bandeja necesita saber de una conversación para pintar la lista. */
export type ConversacionResumen = {
  id: string;
  clientId: string;
  canal: string;
  /** Teléfono u otro identificador externo del contacto. */
  contacto: string | null;
  nombre: string | null;
  modo: "bot" | "human";
  /** Hasta cuándo el bot se queda callado sin que nadie lo reactive. */
  humanoHasta: string | null;
  /** Cuándo pidió el contacto hablar con una persona. */
  pidioPersona: string | null;
  ultimoMensaje: string | null;
  /** Último mensaje del contacto: desde aquí cuentan las 24 h de Meta. */
  ultimoEntrante: string | null;
  avance: string | null;
  sinLeer: number;
};

export type MensajeBandeja = {
  id: string;
  contenido: string;
  quien: "contact" | "bot" | "human";
  fecha: string;
  /** Solo en el optimista, mientras n8n confirma el envío. */
  enviando?: boolean;
  fallo?: string;
};

/**
 * Columnas que hay que pedir para construir un `ConversacionResumen`. Se
 * declara una vez porque las piden tres sitios: la página del panel, la del
 * dashboard y la suscripción de realtime.
 */
// En una sola línea a propósito: el cliente de Supabase infiere el tipo del
// resultado a partir del literal, y si se parte en trozos concatenados deja de
// reconocerlo y devuelve `GenericStringError`.
export const COLUMNAS_CONVERSACION =
  "id, client_id, channel, external_contact_id, contact_name, mode, human_until, handoff_requested_at, last_message_at, last_inbound_at, last_message_preview, unread_count";

export type FilaConversacion = {
  id: string;
  client_id: string;
  channel: string;
  external_contact_id: string | null;
  contact_name: string | null;
  mode: string;
  human_until: string | null;
  handoff_requested_at: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_message_preview: string | null;
  unread_count: number | null;
};

/**
 * El relevo humano caduca solo. La base guarda `mode = 'human'` hasta que
 * alguien lo cambie, pero el workflow ya vuelve a responder pasado
 * `human_until`: si la interfaz siguiera diciendo «estás respondiendo tú»,
 * enseñaría lo contrario de lo que ocurre. Se calcula igual en los dos sitios.
 */
export function relevoVigente(
  modo: string,
  humanUntil: string | null
): boolean {
  if (modo !== "human") return false;
  if (!humanUntil) return true;
  return new Date(humanUntil).getTime() > Date.now();
}

export function desdeFila(fila: FilaConversacion): ConversacionResumen {
  return {
    id: fila.id,
    clientId: fila.client_id,
    canal: fila.channel,
    contacto: fila.external_contact_id,
    nombre: fila.contact_name,
    modo: relevoVigente(fila.mode, fila.human_until) ? "human" : "bot",
    humanoHasta: fila.human_until,
    pidioPersona: fila.handoff_requested_at,
    ultimoMensaje: fila.last_message_at,
    ultimoEntrante: fila.last_inbound_at,
    avance: fila.last_message_preview,
    sinLeer: fila.unread_count ?? 0,
  };
}

/** Cómo se llama el contacto en la lista cuando no sabemos su nombre. */
export function etiquetaContacto(c: ConversacionResumen): string {
  return c.nombre || c.contacto || "Contacto sin identificar";
}

/**
 * Meta solo deja responder con texto libre dentro de las 24 h siguientes al
 * último mensaje del contacto. Pasado ese plazo hace falta una plantilla
 * aprobada, que hoy no tenemos. Se calcula en un solo sitio porque lo usan la
 * interfaz (para desactivar el compositor) y la server action (para no mandar
 * a n8n algo que Meta va a rechazar).
 */
export const VENTANA_MS = 24 * 60 * 60 * 1000;

export function ventanaAbierta(ultimoEntrante: string | null): boolean {
  if (!ultimoEntrante) return false;
  return Date.now() - new Date(ultimoEntrante).getTime() < VENTANA_MS;
}

export function tiempoRestanteVentana(ultimoEntrante: string | null): string {
  if (!ultimoEntrante) return "";
  const restante =
    VENTANA_MS - (Date.now() - new Date(ultimoEntrante).getTime());
  if (restante <= 0) return "";

  const horas = Math.floor(restante / 3_600_000);
  if (horas >= 1) return `${horas} h`;
  return `${Math.max(1, Math.floor(restante / 60_000))} min`;
}
