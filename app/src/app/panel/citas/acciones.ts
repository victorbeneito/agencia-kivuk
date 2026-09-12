"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clienteDelPanel } from "@/lib/auth";
import { prepararCita, type NuevaCita } from "@/lib/citas";

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

/**
 * Crear una cita a mano desde el panel del negocio.
 *
 * Es la mitad que le faltaba a la agenda: una peluquería da muchas de sus citas
 * en el mostrador, cuando la clienta se va y pide la siguiente. Sin esto, el
 * calendario solo enseña lo que dio el bot y hay que seguir llevando la libreta
 * —y entonces ni la libreta ni el calendario están completos, que es peor que
 * tener solo la libreta.
 *
 * Con `service_role` porque el `client_user` no puede escribir, y comprobando
 * aquí lo que la RLS comprobaría: que la trabajadora es de este negocio. Sin
 * eso, bastaría con mandar el id de la trabajadora de otro cliente para
 * colarle una cita.
 */
export async function crearCitaCliente(datos: NuevaCita): Promise<Resultado> {
  const perfil = await clienteDelPanel();

  const preparada = prepararCita(datos);
  if (!preparada.ok) return { ok: false, mensaje: preparada.mensaje };

  const admin = createServiceRoleClient();

  const { data: trabajador } = await admin
    .from("staff")
    .select("id, client_id, activo")
    .eq("id", datos.staff_id)
    .maybeSingle();

  if (!trabajador || trabajador.client_id !== perfil.clientId) {
    return { ok: false, mensaje: "Esa persona no es de tu equipo." };
  }

  const { data, error } = await admin.rpc("agenda_reservar", {
    p_client_id: perfil.clientId,
    p_staff_id: datos.staff_id,
    p_inicio: preparada.inicio,
    p_fin: preparada.fin,
    p_servicios: preparada.servicios.map((s) => ({
      id: datos.servicio_id,
      nombre: s.nombre,
      duracion_min: s.duracion_min,
    })),
    p_nombre: datos.nombre.trim(),
    p_contacto: datos.contacto.trim(),
    p_email: null,
    p_canal: "panel",
    p_notas: datos.notas.trim(),
    p_conversation_id: null,
  });

  if (error) return { ok: false, mensaje: `No se ha podido guardar: ${error.message}` };

  const resultado = data as { ok: boolean; motivo?: string };
  if (!resultado?.ok) {
    return {
      ok: false,
      mensaje:
        resultado?.motivo === "ocupado"
          ? "Esa persona ya tiene una cita a esa hora."
          : "No se ha podido guardar la cita.",
    };
  }

  revalidatePath("/panel/citas");
  return { ok: true };
}
