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
  /**
   * Archivo del mensaje: foto, nota de voz, vídeo o documento. Lo manda el
   * contacto o, desde el 28/10/2026, una persona del negocio desde el panel.
   *
   * Es la ruta dentro del bucket `adjuntos`, no una URL. El bucket es privado
   * —son conversaciones de clientes— y el enlace se firma al mirarlo, con la
   * sesión de quien mira. Una URL guardada en la base de datos o caducaría o
   * sería pública para siempre.
   */
  mediaPath?: string | null;
  mediaType?: string | null;
  /** Meta solo manda nombre de archivo en los documentos. */
  mediaName?: string | null;
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
  return c.nombre || telefonoLegible(c) || c.contacto || "Contacto sin identificar";
}

/**
 * El teléfono del contacto, solo en dígitos y con prefijo de país, tal como lo
 * manda Meta (`34612345678`). Null si el canal no es WhatsApp: en otros canales
 * el identificador externo no es un número al que se pueda escribir.
 */
export function telefonoContacto(c: ConversacionResumen): string | null {
  if (c.canal !== "whatsapp" || !c.contacto) return null;
  return /^\d{8,15}$/.test(c.contacto) ? c.contacto : null;
}

/**
 * El teléfono como lo escribiría una persona. Hace falta verlo aunque sepamos
 * el nombre: pasadas las 24 h de Meta, la única forma de contestar es
 * escribirle o llamarle desde otro número, y con el nombre solo no se puede.
 */
export function telefonoLegible(c: ConversacionResumen): string | null {
  const t = telefonoContacto(c);
  if (!t) return null;
  const es = t.match(/^34(\d{3})(\d{2})(\d{2})(\d{2})$/);
  if (es) return `+34 ${es[1]} ${es[2]} ${es[3]} ${es[4]}`;
  return `+${t}`;
}

/**
 * Enlace que abre un chat con el contacto en el WhatsApp de quien lo pulsa:
 * en el ordenador de un cliente suele ser el número de siempre del negocio,
 * que no tiene la limitación de las 24 h porque es otra cuenta.
 */
export function enlaceWhatsApp(c: ConversacionResumen): string | null {
  const t = telefonoContacto(c);
  return t ? `https://wa.me/${t}` : null;
}

/**
 * Lo que una persona puede mandar desde el panel, con los límites de WhatsApp.
 *
 * Meta solo acepta como foto JPG y PNG de hasta 5 MB, y como vídeo MP4 o 3GPP
 * de hasta 16 MB. Las fotos de otro formato o más grandes (las del móvil suelen
 * pasar de 5 MB) se convierten a JPG en el navegador antes de subirlas, así que
 * aquí solo llegan esos dos. Los documentos admiten hasta 100 MB; se ponen 25
 * para no llenar el almacenamiento con un vídeo enviado como documento.
 */
export const ADJUNTOS_PERMITIDOS: Record<
  string,
  { clase: "foto" | "video" | "documento"; extension: string; maximo: number }
> = {
  "image/jpeg": { clase: "foto", extension: "jpg", maximo: 5 * 1024 * 1024 },
  "image/png": { clase: "foto", extension: "png", maximo: 5 * 1024 * 1024 },
  "video/mp4": { clase: "video", extension: "mp4", maximo: 16 * 1024 * 1024 },
  "video/3gpp": { clase: "video", extension: "3gp", maximo: 16 * 1024 * 1024 },
  "application/pdf": { clase: "documento", extension: "pdf", maximo: 25 * 1024 * 1024 },
  "application/msword": { clase: "documento", extension: "doc", maximo: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    clase: "documento",
    extension: "docx",
    maximo: 25 * 1024 * 1024,
  },
  "application/vnd.ms-excel": { clase: "documento", extension: "xls", maximo: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    clase: "documento",
    extension: "xlsx",
    maximo: 25 * 1024 * 1024,
  },
};

/** El pie de una foto o un vídeo: WhatsApp no admite más. */
export const MAXIMO_PIE = 1024;

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
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
