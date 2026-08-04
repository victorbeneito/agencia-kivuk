"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Aprobación de las piezas generadas.
 *
 * Nada se publica sin pasar por aquí: el workflow de n8n deja todo en `pending`
 * y solo lo aprobado entra en la cola de publicación. Es el punto en el que una
 * persona mira lo que ha escrito la IA antes de que salga con el nombre del
 * cliente.
 */

export type EstadoPieza =
  | "draft"
  | "pending"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "rejected";

async function cambiarEstado(
  clientId: string,
  itemId: string,
  status: EstadoPieza
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("content_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    // El client_id va en el WHERE además del id: aunque las políticas de RLS ya
    // impiden tocar piezas de otro cliente, no cuesta nada no depender solo de
    // ellas para algo que decide qué se publica.
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`No se pudo actualizar la pieza: ${error.message}`);
  }

  revalidatePath(`/dashboard/${clientId}/contenido`);
  revalidatePath(`/dashboard/${clientId}`);
}

export async function aprobarPieza(clientId: string, itemId: string) {
  await cambiarEstado(clientId, itemId, "approved");
}

export type ResultadoPublicar = { ok: boolean; mensaje: string };

/**
 * Mete en la cola una pieza hecha fuera (Pomelli, Canva, un diseñador).
 *
 * La imagen no pasa por Next.js más que de camino: la manda al servicio de
 * render, que es quien tiene sharp, la convierte a JPEG y la deja en el bucket.
 * Aquí solo se escribe la fila. Entra como `pending`, igual que lo generado: se
 * revisa y se aprueba por el mismo sitio.
 */
export async function subirPieza(formData: FormData): Promise<ResultadoPublicar> {
  const clientId = formData.get("client_id") as string;
  const formato = (formData.get("formato") as string) || "post";
  const caption = ((formData.get("caption") as string) ?? "").trim();
  const archivo = formData.get("archivo") as File | null;

  if (!archivo || !archivo.size) {
    return { ok: false, mensaje: "No has elegido ninguna imagen." };
  }
  if (!caption) {
    return { ok: false, mensaje: "Escribe el texto que acompañará a la imagen." };
  }

  const render = process.env.RENDER_BASE_URL || "http://localhost:3001";

  let url: string;
  try {
    const r = await fetch(
      `${render}/subir?client_id=${encodeURIComponent(clientId)}&formato=${encodeURIComponent(formato)}`,
      {
        method: "POST",
        headers: { "Content-Type": archivo.type || "application/octet-stream" },
        body: Buffer.from(await archivo.arrayBuffer()),
        signal: AbortSignal.timeout(60_000),
      }
    );
    const cuerpo = (await r.json().catch(() => null)) as
      | { ok?: boolean; url?: string; error?: string }
      | null;

    if (!cuerpo?.ok || !cuerpo.url) {
      return { ok: false, mensaje: cuerpo?.error || `El servicio de imagen respondió ${r.status}.` };
    }
    url = cuerpo.url;
  } catch (e) {
    return {
      ok: false,
      mensaje: `No se pudo preparar la imagen: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Los hashtags se guardan aparte además de quedar en el texto, para que las
  // piezas subidas se cuenten igual que las generadas.
  const hashtags = [...caption.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);

  const supabase = await createClient();
  const { error } = await supabase.from("content_items").insert({
    client_id: clientId,
    channel: "instagram",
    format: formato,
    status: "pending",
    caption,
    hashtags,
    media_urls: [url],
    meta: { origen: "subida manual", producto: "Pieza subida a mano", avisos: [] },
  });

  if (error) {
    return { ok: false, mensaje: `No se pudo guardar la pieza: ${error.message}` };
  }

  revalidatePath(`/dashboard/${clientId}/contenido`);
  revalidatePath(`/dashboard/${clientId}`);
  return { ok: true, mensaje: "Subida. La tienes en «Por revisar»." };
}

/**
 * Pide a n8n un lote nuevo de piezas.
 *
 * Tarda: por cada pieza hay una llamada al modelo y un render. Se espera a que
 * termine para poder decir cuántas salieron, pero si se agota el tiempo el
 * workflow sigue por su cuenta y las piezas aparecen igual al recargar.
 */
export async function generarLote(
  clientId: string,
  cantidad: number,
  formato: string,
  tema: string
): Promise<ResultadoPublicar> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) {
    return { ok: false, mensaje: "Falta N8N_WEBHOOK_BASE_URL en la configuración." };
  }

  try {
    const r = await fetch(`${base}/webhook/contenido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        cantidad,
        formato,
        tema: tema.trim() || undefined,
      }),
      signal: AbortSignal.timeout(300_000),
    });

    const cuerpo = (await r.json().catch(() => null)) as
      | { ok?: boolean; mensaje?: string }
      | null;

    revalidatePath(`/dashboard/${clientId}/contenido`);
    revalidatePath(`/dashboard/${clientId}`);

    if (!cuerpo) return { ok: false, mensaje: `n8n respondió ${r.status} sin contenido.` };
    return { ok: Boolean(cuerpo.ok), mensaje: cuerpo.mensaje || "Sin respuesta." };
  } catch (e) {
    revalidatePath(`/dashboard/${clientId}/contenido`);
    return {
      ok: false,
      mensaje:
        e instanceof Error && e.name === "TimeoutError"
          ? "Está tardando más de lo normal. Sigue generándose: recarga en un minuto."
          : `No se pudo contactar con n8n: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Lanza la publicación real en Instagram y Facebook.
 *
 * El panel no habla con Meta: solo despierta el workflow de n8n, que es quien
 * tiene los tokens. Así las credenciales no pasan nunca por el proceso de
 * Next.js ni por el navegador.
 */
export async function publicarPieza(
  clientId: string,
  itemId: string
): Promise<ResultadoPublicar> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) {
    return { ok: false, mensaje: "Falta N8N_WEBHOOK_BASE_URL en la configuración." };
  }

  // El workflow vuelve a comprobar el estado, pero se comprueba aquí también:
  // es la diferencia entre un error claro en pantalla y una llamada que se va a
  // n8n para volver rechazada.
  const supabase = await createClient();
  const { data: pieza, error } = await supabase
    .from("content_items")
    .select("status")
    .eq("id", itemId)
    .eq("client_id", clientId)
    .single();

  if (error || !pieza) {
    return { ok: false, mensaje: "No se encuentra esa pieza." };
  }
  if (pieza.status !== "approved" && pieza.status !== "scheduled") {
    return {
      ok: false,
      mensaje:
        pieza.status === "published"
          ? "Esa pieza ya está publicada."
          : "Solo se publica lo aprobado.",
    };
  }

  try {
    const r = await fetch(`${base}/webhook/publicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_item_id: itemId }),
      // Instagram procesa la imagen antes de dejar publicar y el workflow la
      // sondea hasta cinco veces; el tiempo de espera tiene que darle margen.
      signal: AbortSignal.timeout(90_000),
    });

    const cuerpo = (await r.json().catch(() => null)) as ResultadoPublicar | null;

    revalidatePath(`/dashboard/${clientId}/contenido`);
    revalidatePath(`/dashboard/${clientId}`);

    if (!cuerpo) {
      return { ok: false, mensaje: `n8n respondió ${r.status} sin contenido.` };
    }
    return { ok: Boolean(cuerpo.ok), mensaje: cuerpo.mensaje || "Sin respuesta." };
  } catch (e) {
    // La pieza puede haberse quedado en «publishing»: se ve en el panel y se
    // puede mirar la ejecución en n8n. Mejor eso que decir que fue bien.
    const motivo =
      e instanceof Error && e.name === "TimeoutError"
        ? "n8n tardó demasiado. Mira la ejecución en n8n antes de reintentar: puede haberse publicado."
        : `No se pudo contactar con n8n: ${e instanceof Error ? e.message : String(e)}`;
    revalidatePath(`/dashboard/${clientId}/contenido`);
    return { ok: false, mensaje: motivo };
  }
}

export async function descartarPieza(clientId: string, itemId: string) {
  await cambiarEstado(clientId, itemId, "rejected");
}

/** Devuelve una pieza aprobada o descartada a la cola de revisión. */
export async function devolverAPendiente(clientId: string, itemId: string) {
  await cambiarEstado(clientId, itemId, "pending");
}

/**
 * Guarda el texto editado a mano. Al tocarlo se queda en revisión aunque
 * estuviera aprobada: si se cambia lo que se va a publicar, hay que volver a
 * darle el visto bueno.
 */
export async function guardarTexto(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const itemId = formData.get("item_id") as string;
  const caption = (formData.get("caption") as string) ?? "";

  const supabase = await createClient();

  const { error } = await supabase
    .from("content_items")
    .update({
      caption: caption.trim(),
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`No se pudo guardar el texto: ${error.message}`);
  }

  revalidatePath(`/dashboard/${clientId}/contenido`);
}
