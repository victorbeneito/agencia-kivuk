import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { mensajeDeError, stripe } from "@/lib/stripe";

/**
 * Lo que Stripe cuenta de vuelta sobre la domiciliación.
 *
 * Un adeudo SEPA se resuelve días después de lanzarlo, y la devolución puede
 * llegar semanas más tarde: el panel no puede quedarse esperando, así que es
 * Stripe quien avisa aquí. Cinco eventos, y hay que marcarlos en el Dashboard
 * de Stripe al crear el endpoint (ver `docs/cobro-stripe.md`):
 *
 *   checkout.session.completed      → el cliente ha firmado la orden
 *   mandate.updated                 → la orden ha dejado de valer
 *   payment_intent.succeeded        → el banco ha pagado: factura cobrada
 *   payment_intent.payment_failed   → el banco lo ha rechazado
 *   charge.dispute.created          → el cliente ha devuelto el recibo
 *
 * Todo se escribe con `service_role`: aquí no hay sesión de usuario, y quien
 * garantiza que la petición es de Stripe es la firma, que se comprueba antes de
 * leer nada. Sin `STRIPE_WEBHOOK_SECRET` no se acepta ningún evento.
 *
 * Stripe reintenta durante días lo que no responde 2xx, y puede entregar el
 * mismo evento dos veces. Cada manejador deja la fila en el mismo estado se
 * ejecute una vez o tres, así que repetir no hace daño.
 *
 * Esta ruta no pasa por el middleware (no está en su `matcher`): no hay sesión
 * que refrescar.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const s = stripe();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secreto) {
    return NextResponse.json({ ok: false, mensaje: "Stripe sin configurar." }, { status: 500 });
  }

  // La firma se calcula sobre el cuerpo tal cual llega: hay que leerlo como
  // texto, no como JSON, o un espacio de diferencia la invalida.
  const cuerpo = await request.text();
  const firma = request.headers.get("stripe-signature") ?? "";

  let evento: Stripe.Event;
  try {
    evento = s.webhooks.constructEvent(cuerpo, firma, secreto);
  } catch (e) {
    return NextResponse.json(
      { ok: false, mensaje: `Firma no válida: ${mensajeDeError(e)}` },
      { status: 400 }
    );
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed":
        await mandatoFirmado(s, evento.data.object);
        break;
      case "mandate.updated":
        await mandatoCambiado(evento.data.object);
        break;
      case "payment_intent.succeeded":
        await cargoCobrado(evento.data.object);
        break;
      case "payment_intent.payment_failed":
        await cargoFallido(evento.data.object);
        break;
      case "charge.dispute.created":
        await reciboDevuelto(evento.data.object);
        break;
      default:
        // Un evento que no se ha pedido. Se responde 200 igual: si no, Stripe
        // lo reintentaría durante días.
        break;
    }
  } catch (e) {
    // 500 para que Stripe lo reintente: el fallo suele ser de red o de la base,
    // y dentro de un rato probablemente funcione.
    console.error(`stripe webhook ${evento.type} ${evento.id}:`, mensajeDeError(e));
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function refrescarPantallas(clientId?: string, facturaId?: string) {
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/panel/facturas");
  if (clientId) revalidatePath(`/dashboard/${clientId}/facturacion`);
  if (facturaId) revalidatePath(`/dashboard/facturacion/${facturaId}`);
}

// === La orden de domiciliación ===

async function mandatoFirmado(s: Stripe, sesion: Stripe.Checkout.Session) {
  // Solo las sesiones de domiciliación (modo `setup`) que ha creado el panel.
  // Un Payment Link pegado a mano en una factura también dispara este evento.
  const clientId = sesion.metadata?.client_id;
  if (sesion.mode !== "setup" || !clientId || !sesion.setup_intent) return;

  const setupIntentId =
    typeof sesion.setup_intent === "string" ? sesion.setup_intent : sesion.setup_intent.id;

  const setupIntent = await s.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });

  const metodo = setupIntent.payment_method;
  if (!metodo || typeof metodo === "string" || setupIntent.status !== "succeeded") return;

  const mandato =
    typeof setupIntent.mandate === "string" ? setupIntent.mandate : setupIntent.mandate?.id;

  const db = createServiceRoleClient();
  const { error } = await db
    .from("client_billing_profiles")
    .update({
      stripe_customer_id:
        typeof sesion.customer === "string" ? sesion.customer : sesion.customer?.id,
      sepa_payment_method_id: metodo.id,
      sepa_mandate_id: mandato ?? null,
      sepa_ultimos4: metodo.sepa_debit?.last4 ?? null,
      sepa_firmado_at: new Date().toISOString(),
      // Quien firma la domiciliación es para pagar así. Las facturas que se
      // generen desde ahora salen con esta forma de pago.
      forma_pago: "domiciliacion",
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
  refrescarPantallas(clientId);
}

async function mandatoCambiado(mandato: Stripe.Mandate) {
  // `inactive`: el cliente la ha revocado en su banco o la cuenta ya no existe.
  // Se quita de la ficha para que nadie lance un cargo que va a fallar; la
  // forma de pago se deja como estaba, que es la conversación pendiente.
  if (mandato.status !== "inactive") return;

  const db = createServiceRoleClient();
  const { data: fila } = await db
    .from("client_billing_profiles")
    .select("client_id")
    .eq("sepa_mandate_id", mandato.id)
    .maybeSingle();

  if (!fila) return;

  const { error } = await db
    .from("client_billing_profiles")
    .update({
      sepa_payment_method_id: null,
      sepa_mandate_id: null,
      sepa_ultimos4: null,
      sepa_firmado_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", fila.client_id);

  if (error) throw new Error(error.message);
  refrescarPantallas(fila.client_id);
}

// === Los cargos ===

async function cargoCobrado(cargo: Stripe.PaymentIntent) {
  // Los cargos del panel llevan la factura en los metadatos. Los que no (un
  // Payment Link, un cobro hecho a mano en Stripe) no son asunto de aquí.
  const facturaId = cargo.metadata?.invoice_id;
  if (!facturaId) return;

  const db = createServiceRoleClient();
  const { data: factura } = await db
    .from("invoices")
    .select("client_id, estado")
    .eq("id", facturaId)
    .maybeSingle();

  if (!factura) return;

  const { error } = await db
    .from("invoices")
    .update({
      // Una factura anulada que se cobra igualmente se queda anulada: el dinero
      // habrá que devolverlo, pero el documento no resucita.
      estado: factura.estado === "anulada" ? "anulada" : "pagada",
      pagada_at: new Date().toISOString(),
      referencia_pago: `Domiciliación SEPA · ${cargo.id}`,
      stripe_payment_intent_id: cargo.id,
      cobro_estado: "cobrado",
      cobro_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId);

  if (error) throw new Error(error.message);
  refrescarPantallas(factura.client_id, facturaId);
}

async function cargoFallido(cargo: Stripe.PaymentIntent) {
  const facturaId = cargo.metadata?.invoice_id;
  if (!facturaId) return;

  const db = createServiceRoleClient();
  const { data: factura } = await db
    .from("invoices")
    .select("client_id")
    .eq("id", facturaId)
    .maybeSingle();

  if (!factura) return;

  const { error } = await db
    .from("invoices")
    .update({
      cobro_estado: "fallido",
      cobro_error: motivoDelFallo(cargo),
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId)
    // Solo el intento vigente: el fallo de uno viejo no pisa un reintento.
    .eq("stripe_payment_intent_id", cargo.id);

  if (error) throw new Error(error.message);
  refrescarPantallas(factura.client_id, facturaId);
}

/**
 * Devolución de un recibo.
 *
 * Con la domiciliación SEPA el cliente puede pedir a su banco que le devuelva
 * un cargo hasta ocho semanas después, sin dar motivo. Stripe lo trata como una
 * disputa y retira el dinero del saldo. La factura vuelve a quedar pendiente:
 * ya no está cobrada, aunque lo estuvo.
 */
async function reciboDevuelto(disputa: Stripe.Dispute) {
  const cargoId =
    typeof disputa.payment_intent === "string"
      ? disputa.payment_intent
      : disputa.payment_intent?.id;
  if (!cargoId) return;

  const db = createServiceRoleClient();
  const { data: factura } = await db
    .from("invoices")
    .select("id, client_id, estado, enviada_at")
    .eq("stripe_payment_intent_id", cargoId)
    .maybeSingle();

  if (!factura) return;

  const pendiente = factura.enviada_at ? "enviada" : "emitida";

  const { error } = await db
    .from("invoices")
    .update({
      estado: factura.estado === "pagada" ? pendiente : factura.estado,
      pagada_at: factura.estado === "pagada" ? null : undefined,
      referencia_pago: factura.estado === "pagada" ? null : undefined,
      cobro_estado: "devuelto",
      cobro_error: `Recibo devuelto por el banco del cliente (${MOTIVOS_DEVOLUCION[disputa.reason] ?? disputa.reason}).`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", factura.id);

  if (error) throw new Error(error.message);
  refrescarPantallas(factura.client_id, factura.id);
}

const MOTIVOS_DEVOLUCION: Record<string, string> = {
  debit_not_authorized: "dice que no autorizó el cargo",
  general: "sin motivo, dentro de las 8 semanas",
  insufficient_funds: "sin fondos",
  duplicate: "cargo duplicado",
  fraudulent: "lo marca como fraude",
};

function motivoDelFallo(cargo: Stripe.PaymentIntent): string {
  const e = cargo.last_payment_error;
  if (!e) return "El banco del cliente ha rechazado el cargo.";
  // Los códigos SEPA más habituales, en castellano. El resto, tal cual.
  const conocidos: Record<string, string> = {
    insufficient_funds: "La cuenta no tiene fondos suficientes.",
    account_closed: "La cuenta está cerrada.",
    debit_not_authorized: "El banco dice que el cargo no está autorizado.",
    bank_account_restricted: "La cuenta no admite cargos por domiciliación.",
    generic_decline: "El banco del cliente ha rechazado el cargo.",
  };
  const codigo = e.decline_code ?? e.code ?? "";
  return conocidos[codigo] ?? e.message ?? "El banco del cliente ha rechazado el cargo.";
}
