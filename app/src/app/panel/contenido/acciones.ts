"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clienteDelPanel } from "@/lib/auth";

/**
 * Lo que el cliente puede hacer con sus piezas: darles el visto bueno,
 * descartarlas o retocar el texto.
 *
 * Su RLS es de solo lectura sobre `content_items` (ver 0008), así que se escribe
 * con `service_role`. A cambio, aquí se comprueban dos cosas que un UPDATE
 * directo no comprobaría: que la pieza es suya, y que el salto de estado tiene
 * sentido. Aprobar es lo que la mete en la cola de publicación — no es un campo
 * más.
 */

export type Resultado = { ok: boolean; mensaje?: string };

/** Desde qué estados se puede tocar una pieza. Lo publicado ya no se toca. */
const REVISABLES = ["pending", "failed", "draft"];

async function piezaDelCliente(itemId: string) {
  // Vale tanto para el cliente como para la agencia mirando su panel: los dos
  // pueden aprobar, y en los dos casos hay que comprobar que la pieza es de ese
  // cliente antes de tocarla.
  const perfil = await clienteDelPanel();
  const admin = createServiceRoleClient();

  const { data: pieza } = await admin
    .from("content_items")
    .select("id, client_id, status")
    .eq("id", itemId)
    .single();

  if (!pieza || pieza.client_id !== perfil.clientId) {
    throw new Error("Esa pieza no es tuya.");
  }

  return { admin, pieza };
}

async function cambiarEstado(
  itemId: string,
  destino: "approved" | "rejected" | "pending",
  desde: string[]
): Promise<Resultado> {
  const { admin, pieza } = await piezaDelCliente(itemId);

  if (!desde.includes(pieza.status)) {
    return {
      ok: false,
      mensaje: "Esta pieza ya no está en ese punto. Recarga la página.",
    };
  }

  const { error } = await admin
    .from("content_items")
    .update({ status: destino, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel/contenido");
  revalidatePath("/panel");
  return { ok: true };
}

export async function aprobar(itemId: string) {
  return cambiarEstado(itemId, "approved", REVISABLES);
}

export async function descartar(itemId: string) {
  return cambiarEstado(itemId, "rejected", REVISABLES);
}

/** Deshacer: devuelve a revisión algo aprobado o descartado por error. */
export async function volverARevisar(itemId: string) {
  return cambiarEstado(itemId, "pending", ["approved", "rejected"]);
}

/**
 * Guarda el texto retocado. La pieza vuelve a revisión aunque estuviera
 * aprobada: si cambia lo que se va a publicar, el visto bueno anterior era
 * sobre otra cosa.
 */
export async function guardarTexto(
  itemId: string,
  caption: string
): Promise<Resultado> {
  const { admin, pieza } = await piezaDelCliente(itemId);

  if (pieza.status === "published" || pieza.status === "publishing") {
    return { ok: false, mensaje: "Esta pieza ya está publicada." };
  }

  const { error } = await admin
    .from("content_items")
    .update({
      caption: caption.trim(),
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel/contenido");
  return { ok: true };
}
