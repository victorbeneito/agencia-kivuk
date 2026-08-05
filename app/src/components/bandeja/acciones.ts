"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { exigirAccesoACliente, getPerfil } from "@/lib/auth";
import { relevoVigente, ventanaAbierta } from "./tipos";

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
 *
 * El panel no habla con Meta: se lo pide a n8n, que es quien tiene el token del
 * cliente, envía y guarda el mensaje. Se espera su respuesta para poder decir
 * si salió o no — un "enviado" que en realidad no llegó es peor que un error.
 */
export async function enviarMensaje(
  conversationId: string,
  texto: string
): Promise<Resultado> {
  const { conversacion } = await conversacionAccesible(conversationId);
  const perfil = await getPerfil();

  const contenido = texto.trim();
  if (!contenido) return { ok: false, mensaje: "El mensaje está vacío." };

  // El relevo caduca, así que no basta con mirar `mode`: si venció mientras la
  // pestaña seguía abierta, el bot ya ha vuelto y escribir por encima sería
  // hablar los dos a la vez.
  if (!relevoVigente(conversacion.mode, conversacion.human_until)) {
    return {
      ok: false,
      mensaje: "Toma el mando de la conversación antes de escribir.",
    };
  }

  // La misma comprobación que hace la interfaz, repetida aquí: la de allí es
  // para que no se escriba en balde, esta es la que de verdad manda.
  if (!ventanaAbierta(conversacion.last_inbound_at)) {
    return {
      ok: false,
      mensaje:
        "Han pasado más de 24 horas desde su último mensaje. WhatsApp ya no " +
        "permite escribirle libremente hasta que vuelva a escribir él.",
    };
  }

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
      body: JSON.stringify({
        conversation_id: conversationId,
        texto: contenido,
        sent_by_user_id: perfil?.userId ?? null,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const cuerpo = (await r.json().catch(() => null)) as
      | { ok?: boolean; mensaje?: string; message_id?: string }
      | null;

    revalidarBandeja(conversacion.client_id);

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
