"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clienteDelPanel } from "@/lib/auth";

export type Resultado = { ok: boolean; mensaje?: string };

export type Avisos = {
  enPanel: boolean;
  porEmail: boolean;
  email: string;
  push: boolean;
};

/**
 * Preferencias de aviso del cliente.
 *
 * Las guarda la agencia o el propio cliente, según quién esté mirando el panel:
 * las dos vías pasan por `clienteDelPanel()`, que ya resuelve de quién es y
 * comprueba el acceso.
 */
export async function guardarAvisos(avisos: Avisos): Promise<Resultado> {
  const { clientId } = await clienteDelPanel();

  const email = avisos.email.trim();

  // Pedir aviso por correo sin decir a dónde es pedir que no llegue. Vale más
  // negarse aquí que dejarlo guardado y que el fallo aparezca dentro de una
  // semana, cuando alguien esté esperando.
  if (avisos.porEmail && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    return {
      ok: false,
      mensaje: "Escribe un correo válido al que mandar los avisos.",
    };
  }

  const admin = createServiceRoleClient();

  // `push` NO se escribe aquí a propósito. Ese interruptor no es una casilla de
  // este formulario: lo gobierna el permiso que da cada dispositivo, y lo pone a
  // true `registrarDispositivo()` al suscribir el móvil.
  //
  // Cuando sí se escribía, pasaba esto: el usuario activaba el aviso en el móvil
  // (push -> true) y a continuación pulsaba Guardar, que mandaba el `push` que
  // traía el formulario desde que se cargó la página —false— y lo pisaba. El
  // dispositivo quedaba suscrito y el canal apagado, así que no llegaba ninguna
  // notificación y nada lo delataba.
  const { error } = await admin.from("client_notification_settings").upsert(
    {
      client_id: clientId,
      en_panel: avisos.enPanel,
      por_email: avisos.porEmail,
      email: email || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel/cuenta");
  revalidatePath("/panel", "layout");
  return { ok: true };
}
