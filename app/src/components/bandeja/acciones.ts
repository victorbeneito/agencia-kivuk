"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { exigirAccesoACliente, getPerfil } from "@/lib/auth";
import {
  ADJUNTOS_PERMITIDOS,
  MAXIMO_PIE,
  relevoVigente,
  tamanoLegible,
  ventanaAbierta,
} from "./tipos";

/**
 * Todo lo que se escribe desde la bandeja.
 *
 * Ninguna de estas operaciones se hace desde el navegador contra Supabase: la
 * RLS del `client_user` es de solo lectura a propósito (ver 0008). Aquí se usa
 * `service_role`, así que cada acción empieza comprobando que quien llama tiene
 * algo que ver con esa conversación.
 */

export type Resultado = {
  ok: boolean;
  mensaje?: string;
  /** Al enviar: el id del mensaje ya guardado, para no esperar a Realtime. */
  id?: string;
};

/** Cuánto tiempo se queda callado el bot cuando alguien toma el mando. */
const RELEVO_HORAS = 2;

async function conversacionAccesible(conversationId: string) {
  const admin = createServiceRoleClient();

  const { data: conversacion } = await admin
    .from("conversations")
    .select("id, client_id, last_inbound_at, mode, human_until")
    .eq("id", conversationId)
    .single();

  if (!conversacion) throw new Error("Esa conversación no existe.");

  await exigirAccesoACliente(conversacion.client_id);

  return { admin, conversacion };
}

/**
 * Una persona se pone al mando: el bot deja de responder a este contacto.
 *
 * `human_until` es un seguro. Sin él, abrir un chat y olvidarse deja al
 * contacto hablando con nadie: el bot callado y ninguna persona mirando. Pasado
 * el plazo, el workflow vuelve a responder solo.
 */
export async function tomarElMando(conversationId: string): Promise<Resultado> {
  const { admin, conversacion } = await conversacionAccesible(conversationId);
  const perfil = await getPerfil();

  const hasta = new Date(Date.now() + RELEVO_HORAS * 3_600_000).toISOString();

  const { error } = await admin
    .from("conversations")
    .update({
      mode: "human",
      human_until: hasta,
      assigned_to: perfil?.userId ?? null,
      unread_count: 0,
    })
    .eq("id", conversationId);

  if (error) return { ok: false, mensaje: error.message };

  revalidarBandeja(conversacion.client_id);
  return { ok: true };
}

export async function devolverAlBot(conversationId: string): Promise<Resultado> {
  const { admin, conversacion } = await conversacionAccesible(conversationId);

  const { error } = await admin
    .from("conversations")
    .update({
      mode: "bot",
      human_until: null,
      assigned_to: null,
      // Se da por atendida la petición de hablar con una persona: ya ha pasado.
      handoff_requested_at: null,
    })
    .eq("id", conversationId);

  if (error) return { ok: false, mensaje: error.message };

  revalidarBandeja(conversacion.client_id);
  return { ok: true };
}

export async function marcarLeida(conversationId: string): Promise<Resultado> {
  const { admin, conversacion } = await conversacionAccesible(conversationId);

  const { error } = await admin
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);

  if (error) return { ok: false, mensaje: error.message };

  revalidarBandeja(conversacion.client_id);
  return { ok: true };
}

/**
 * Envía un mensaje escrito por una persona.
 */
export async function enviarMensaje(
  conversationId: string,
  texto: string
): Promise<Resultado> {
  const { conversacion } = await conversacionAccesible(conversationId);
  const perfil = await getPerfil();

  const contenido = texto.trim();
  if (!contenido) return { ok: false, mensaje: "El mensaje está vacío." };

  const motivo = noSePuedeEscribir(conversacion);
  if (motivo) return { ok: false, mensaje: motivo };

  return pedirEnvio(conversacion.client_id, {
    conversation_id: conversationId,
    texto: contenido,
    sent_by_user_id: perfil?.userId ?? null,
  });
}

/**
 * Lo que impide escribir ahora mismo, o null si se puede.
 *
 * Son las mismas comprobaciones que hace la interfaz, repetidas aquí: las de
 * allí son para que no se escriba en balde, estas son las que de verdad mandan.
 */
function noSePuedeEscribir(conversacion: {
  mode: string;
  human_until: string | null;
  last_inbound_at: string | null;
}): string | null {
  // El relevo caduca, así que no basta con mirar `mode`: si venció mientras la
  // pestaña seguía abierta, el bot ya ha vuelto y escribir por encima sería
  // hablar los dos a la vez.
  if (!relevoVigente(conversacion.mode, conversacion.human_until)) {
    return "Toma el mando de la conversación antes de escribir.";
  }
  if (!ventanaAbierta(conversacion.last_inbound_at)) {
    return (
      "Han pasado más de 24 horas desde su último mensaje. WhatsApp ya no " +
      "permite escribirle libremente hasta que vuelva a escribir él."
    );
  }
  return null;
}

type DatosAdjunto = { tipo: string; tamano: number; nombre: string | null };

/** El tipo y el tamaño, contra los límites de WhatsApp. Null si vale. */
function adjuntoNoValido({ tipo, tamano }: DatosAdjunto): string | null {
  const permitido = ADJUNTOS_PERMITIDOS[tipo];
  if (!permitido) {
    return "Ese tipo de archivo no se puede enviar por WhatsApp. Usa una foto, un vídeo MP4 o un PDF.";
  }
  if (!(tamano > 0)) return "El archivo está vacío.";
  if (tamano > permitido.maximo) {
    return `Pasa de ${tamanoLegible(permitido.maximo)}, el máximo de WhatsApp para ${
      permitido.clase === "foto" ? "una foto" : permitido.clase === "video" ? "un vídeo" : "un documento"
    }.`;
  }
  return null;
}

/**
 * Primer paso para mandar un archivo: un permiso para subirlo.
 *
 * El archivo no pasa por aquí. Una server action no admite más de 1 MB, y una
 * foto del móvil ya pesa más; así que el navegador lo sube directamente al
 * bucket privado con un permiso firmado de un solo uso, que solo vale para esta
 * ruta. La ruta empieza por el cliente de la conversación, que es lo que mira
 * la RLS del bucket para dejar verlo luego (0012).
 */
export async function prepararSubida(
  conversationId: string,
  datos: DatosAdjunto
): Promise<{ ok: boolean; mensaje?: string; path?: string; token?: string }> {
  const { admin, conversacion } = await conversacionAccesible(conversationId);

  const motivo = noSePuedeEscribir(conversacion) ?? adjuntoNoValido(datos);
  if (motivo) return { ok: false, mensaje: motivo };

  const extension = ADJUNTOS_PERMITIDOS[datos.tipo].extension;
  const path = `${conversacion.client_id}/enviados/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await admin.storage
    .from("adjuntos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, mensaje: `No se pudo preparar la subida: ${error?.message ?? "sin respuesta"}` };
  }
  return { ok: true, path: data.path, token: data.token };
}

/**
 * Segundo paso: con el archivo ya subido, se manda por WhatsApp.
 *
 * Meta no recibe el archivo de nosotros: lo descarga de un enlace. El enlace
 * es firmado y caduca en una hora, de sobra para que Meta lo baje y poco para
 * que ande suelto. En el mensaje se guarda la ruta, nunca el enlace.
 */
export async function enviarAdjunto(
  conversationId: string,
  adjunto: DatosAdjunto & { path: string },
  texto: string
): Promise<Resultado> {
  const { admin, conversacion } = await conversacionAccesible(conversationId);
  const perfil = await getPerfil();

  const pie = texto.trim();
  const motivo =
    noSePuedeEscribir(conversacion) ??
    adjuntoNoValido(adjunto) ??
    (pie.length > MAXIMO_PIE
      ? `El texto que acompaña al archivo no puede pasar de ${MAXIMO_PIE} caracteres.`
      : null);
  if (motivo) return { ok: false, mensaje: motivo };

  // Solo archivos subidos para este cliente con `prepararSubida`: sin esto, quien
  // tenga acceso a un cliente podría mandar por WhatsApp un adjunto de otro.
  if (!adjunto.path.startsWith(`${conversacion.client_id}/enviados/`)) {
    return { ok: false, mensaje: "Ese archivo no es de esta conversación." };
  }

  const { data: firmado, error } = await admin.storage
    .from("adjuntos")
    .createSignedUrl(adjunto.path, 3600);

  if (error || !firmado?.signedUrl) {
    return { ok: false, mensaje: "El archivo no ha llegado a subirse. Vuelve a intentarlo." };
  }

  return pedirEnvio(conversacion.client_id, {
    conversation_id: conversationId,
    texto: pie,
    adjunto: {
      url: firmado.signedUrl,
      path: adjunto.path,
      tipo: adjunto.tipo,
      nombre: adjunto.nombre,
      tamano: adjunto.tamano,
    },
    sent_by_user_id: perfil?.userId ?? null,
  });
}

/**
 * Pide a n8n que envíe y espera su respuesta.
 *
 * El panel no habla con Meta: se lo pide a n8n, que es quien tiene el token del
 * cliente, envía y guarda el mensaje. Se espera su respuesta para poder decir
 * si salió o no — un "enviado" que en realidad no llegó es peor que un error.
 */
async function pedirEnvio(
  clientId: string,
  cuerpoPeticion: Record<string, unknown>
): Promise<Resultado> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) {
    return { ok: false, mensaje: "Falta N8N_WEBHOOK_BASE_URL en la configuración." };
  }

  try {
    const r = await fetch(`${base}/webhook/enviar-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Este webhook envía WhatsApp en nombre de un negocio: sin secreto
        // compartido, cualquiera que adivine la URL puede escribir a sus
        // clientes.
        "x-kivuk-token": process.env.N8N_WEBHOOK_TOKEN ?? "",
      },
      body: JSON.stringify(cuerpoPeticion),
      // Un vídeo tarda más: Meta lo descarga del enlace antes de contestar.
      signal: AbortSignal.timeout(60_000),
    });

    const cuerpo = (await r.json().catch(() => null)) as
      | { ok?: boolean; mensaje?: string; message_id?: string }
      | null;

    revalidarBandeja(clientId);

    if (!cuerpo) {
      return { ok: false, mensaje: `n8n respondió ${r.status} sin contenido.` };
    }
    return {
      ok: Boolean(cuerpo.ok),
      mensaje: cuerpo.ok ? undefined : cuerpo.mensaje || "No se pudo enviar.",
      id: cuerpo.message_id,
    };
  } catch (e) {
    return {
      ok: false,
      mensaje:
        e instanceof Error && e.name === "TimeoutError"
          ? "WhatsApp está tardando en responder. Comprueba si ha llegado antes de reenviarlo."
          : `No se pudo contactar con n8n: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function revalidarBandeja(clientId: string) {
  revalidatePath("/panel/conversaciones");
  revalidatePath("/panel");
  revalidatePath(`/dashboard/${clientId}/conversaciones`);
}
