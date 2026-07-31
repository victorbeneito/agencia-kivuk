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
