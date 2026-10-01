"use server";

import { redirect } from "next/navigation";

import { clienteDelPanel } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { crearSesionDomiciliacion, mensajeDeError } from "@/lib/stripe";

/**
 * El cliente domicilia sus recibos desde su panel.
 *
 * Regla del `client_user`: lee, no escribe. Lo único que se escribe aquí es el
 * id de su `Customer` en Stripe, y va con `service_role` después de que
 * `clienteDelPanel()` haya resuelto de quién es el panel. El IBAN no pasa por
 * aquí: lo escribe en la página de Stripe y la ficha la actualiza el webhook.
 *
 * Sin caducidad, al contrario que el enlace que genera la agencia: la sesión de
 * Stripe se crea en el momento de pulsar.
 */
export async function domiciliarRecibos(): Promise<void> {
  const { clientId } = await clienteDelPanel();

  let url: string;
  try {
    url = await crearSesionDomiciliacion(createServiceRoleClient(), clientId, "/panel/facturas");
  } catch (e) {
    // El detalle técnico va al log; al cliente, un aviso que entienda.
    console.error("domiciliarRecibos:", clientId, mensajeDeError(e));
    redirect("/panel/facturas?domiciliacion=error");
  }

  redirect(url);
}
