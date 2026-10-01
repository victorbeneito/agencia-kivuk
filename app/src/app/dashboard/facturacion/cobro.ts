"use server";

import { revalidatePath } from "next/cache";

import { requireAgencia } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DIAS_AVISO_SEPA, euros, fecha, num, sumarDias } from "@/lib/facturacion";
import {
  cobrarFactura,
  crearSesionDomiciliacion,
  mensajeDeError,
  stripeConfigurado,
} from "@/lib/stripe";

/**
 * El cobro por domiciliación desde el panel de la agencia.
 *
 * Como en `acciones.ts`, se escribe con la sesión de la agencia y no con
 * `service_role`: todo lo que se toca aquí (la ficha fiscal y la factura) ya lo
 * puede escribir el `agency_admin` por RLS, así que las políticas siguen siendo
 * la frontera.
 */

export type ResultadoEnlace = { ok: boolean; mensaje: string; url?: string };

/**
 * Enlace para que el cliente firme la domiciliación.
 *
 * Para abrirlo delante de él (en la visita de alta) o mandárselo por WhatsApp
 * ese mismo día: caduca a las 24 horas. Si no llega a tiempo, puede hacerlo él
 * desde su panel, en Facturas, sin caducidad.
 */
export async function enlaceDomiciliacion(clientId: string): Promise<ResultadoEnlace> {
  await requireAgencia();

  if (!stripeConfigurado()) {
    return { ok: false, mensaje: "Falta STRIPE_SECRET_KEY en el entorno del panel." };
  }

  const supabase = await createClient();

  // La RLS decide: si el cliente no es de esta agencia, no hay ficha.
  const { data: perfil } = await supabase
    .from("client_billing_profiles")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!perfil) return { ok: false, mensaje: "No se encuentra la ficha de este cliente." };

  try {
    const url = await crearSesionDomiciliacion(supabase, clientId, "/domiciliacion");
    revalidatePath(`/dashboard/${clientId}/facturacion`);
    return { ok: true, mensaje: "Enlace creado. Caduca en 24 horas.", url };
  } catch (e) {
    return { ok: false, mensaje: `Stripe no ha podido crear el enlace: ${mensajeDeError(e)}` };
  }
}

/**
 * Carga el total de una factura en la cuenta domiciliada del cliente.
 *
 * Tres condiciones, y las tres tienen motivo:
 *
 *   - **Enviada.** El correo con la factura es el aviso previo del cargo que
 *     exige la domiciliación: importe y fecha antes de tocar la cuenta.
 *   - **Hace al menos `DIAS_AVISO_SEPA` días.** Es el plazo que pacta la orden
 *     que firma el cliente. Cargar antes da pie a que lo devuelva con razón.
 *   - **Forma de pago de la factura = domiciliación.** Lo que dice el documento
 *     es lo que se hace: una factura que pone «transferencia» no se carga.
 */
export async function cobrarPorDomiciliacion(id: string): Promise<{ ok: boolean; mensaje: string }> {
  await requireAgencia();
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("invoices")
    .select(
      "id, client_id, numero, estado, total, forma_pago, enviada_at, cobro_estado, stripe_payment_intent_id"
    )
    .eq("id", id)
    .single();

  if (!factura) return { ok: false, mensaje: "No se encuentra la factura." };

  if (factura.forma_pago !== "domiciliacion") {
    return {
      ok: false,
      mensaje: "La forma de pago de esta factura no es domiciliación: no se puede cargar.",
    };
  }
  if (factura.estado === "pagada" || factura.cobro_estado === "cobrado") {
    return { ok: false, mensaje: "Esta factura ya está cobrada." };
  }
  if (factura.cobro_estado === "en_curso") {
    return {
      ok: false,
      mensaje: "Ya hay un cargo en curso. El banco del cliente tarda unos días en confirmarlo.",
    };
  }
  if (factura.estado !== "enviada" || !factura.enviada_at) {
    return {
      ok: false,
      mensaje:
        "Envíala antes por correo: ese correo es el aviso previo del cargo que exige la domiciliación.",
    };
  }

  const desde = sumarDias(factura.enviada_at.slice(0, 10), DIAS_AVISO_SEPA);
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy < desde) {
    return {
      ok: false,
      mensaje: `Se avisó el ${fecha(factura.enviada_at)}. Se puede cargar a partir del ${fecha(desde)}.`,
    };
  }

  const total = num(factura.total);
  if (total <= 0) return { ok: false, mensaje: "La factura no tiene importe que cobrar." };

  const { data: perfil } = await supabase
    .from("client_billing_profiles")
    .select("stripe_customer_id, sepa_payment_method_id, sepa_mandate_id")
    .eq("client_id", factura.client_id)
    .maybeSingle();

  if (!perfil?.stripe_customer_id || !perfil.sepa_payment_method_id || !perfil.sepa_mandate_id) {
    return {
      ok: false,
      mensaje:
        "El cliente todavía no ha firmado la domiciliación. Mándale el enlace desde su pestaña de Facturación.",
    };
  }

  let cargo;
  try {
    cargo = await cobrarFactura({
      facturaId: factura.id,
      numero: factura.numero ?? factura.id,
      clientId: factura.client_id,
      total,
      customerId: perfil.stripe_customer_id,
      paymentMethodId: perfil.sepa_payment_method_id,
      intentoAnterior: factura.stripe_payment_intent_id,
    });
  } catch (e) {
    return { ok: false, mensaje: `Stripe ha rechazado el cargo: ${mensajeDeError(e)}` };
  }

  // Lo normal en SEPA es `processing`. Si Stripe lo rechaza en el acto (mandato
  // revocado, por ejemplo) vuelve sin método de pago y con el motivo.
  const fallido = cargo.status === "requires_payment_method" || cargo.status === "canceled";

  const { error } = await supabase
    .from("invoices")
    .update({
      stripe_payment_intent_id: cargo.id,
      cobro_estado: fallido ? "fallido" : "en_curso",
      cobro_iniciado_at: new Date().toISOString(),
      cobro_error: fallido ? (cargo.last_payment_error?.message ?? "Rechazado por Stripe.") : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/dashboard/facturacion/${id}`);
  revalidatePath("/dashboard/facturacion");

  if (error) {
    // El cargo ya está lanzado en Stripe aunque no se haya podido apuntar: el
    // webhook lo encontrará por los metadatos y cerrará la factura igual.
    return {
      ok: true,
      mensaje: `Cargo lanzado (${cargo.id}), pero no se pudo apuntar aquí: ${error.message}`,
    };
  }

  if (fallido) {
    return { ok: false, mensaje: `Stripe no ha podido cargarlo: ${cargo.last_payment_error?.message ?? cargo.status}` };
  }

  return {
    ok: true,
    mensaje: `Cargo de ${euros(total)} lanzado. El banco del cliente tarda unos días hábiles en confirmarlo; la factura se marcará como cobrada sola.`,
  };
}
