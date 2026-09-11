"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clienteDelPanel } from "@/lib/auth";

export type Resultado = { ok: boolean; mensaje?: string };

/**
 * Cancelar una cita desde el panel.
 *
 * El `client_user` tiene RLS de solo lectura sobre `appointments` (0014), así
 * que se escribe con `service_role`. A cambio, aquí se comprueba lo que un
 * UPDATE directo no comprobaría: que la cita es suya, que sigue confirmada y
 * que no ha pasado ya.
 *
 * La cancelación no borra la fila: la marca. La restricción anti-solape solo
 * mira las confirmadas, así que el hueco queda libre en el momento y el
 * historial se conserva — que es lo que hace falta el día que alguien pregunte
 * por qué su cita desapareció.
 */
export async function cancelarCita(citaId: string): Promise<Resultado> {
  const perfil = await clienteDelPanel();
  const admin = createServiceRoleClient();

  const { data: cita } = await admin
    .from("appointments")
    .select("id, client_id, estado, fin, google_event_id")
    .eq("id", citaId)
    .maybeSingle();

  if (!cita || cita.client_id !== perfil.clientId) {
    return { ok: false, mensaje: "Esa cita no es tuya." };
  }

  if (cita.estado !== "confirmada") {
    return { ok: false, mensaje: "Esa cita ya estaba cancelada. Recarga la página." };
  }

  if (new Date(cita.fin).getTime() < Date.now()) {
    return { ok: false, mensaje: "Esa cita ya ha pasado, no se puede cancelar." };
  }

  // Se usa la función de la migración 0015 en vez de un update a mano: es la
  // misma que usa la Agenda API cuando tiene que deshacer una reserva, y así la
  // condición de "solo si estaba confirmada" vive en un único sitio.
  const { error } = await admin.rpc("agenda_cancelar", { p_id: citaId });

  if (error) {
    return { ok: false, mensaje: `No se ha podido cancelar: ${error.message}` };
  }

  // El evento de Google, si lo había, se queda. Borrarlo necesita el token del
  // negocio, que vive en el módulo y solo usa n8n; mientras eso no exista, es
  // preferible un evento de más en un calendario que una cita fantasma
  // ocupando un hueco en la base, que es lo que decide de verdad.
  revalidatePath("/panel/citas");

  return { ok: true };
}
