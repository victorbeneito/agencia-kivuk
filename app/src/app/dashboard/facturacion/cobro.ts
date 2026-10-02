"use server";

import { revalidatePath } from "next/cache";

import { requireAgencia } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DIAS_AVISO_SEPA, euros, fecha, num, sumarDias } from "@/lib/facturacion";
import { crearToken, DIAS_VALIDEZ_ENLACE } from "@/lib/enlace-domiciliacion";
import { KIVUK } from "@/lib/web/kivuk";
import { cobrarFactura, mensajeDeError, stripeConfigurado, urlBase } from "@/lib/stripe";

/**
 * El cobro por domiciliación desde el panel de la agencia.
 *
 * Como en `acciones.ts`, se escribe con la sesión de la agencia y no con
 * `service_role`: todo lo que se toca aquí (la ficha fiscal y la factura) ya lo
 * puede escribir el `agency_admin` por RLS, así que las políticas siguen siendo
 * la frontera.
 */

export type ResultadoEnlace = {
  ok: boolean;
  mensaje: string;
  url?: string;
  /** Teléfono de la ficha en formato wa.me (34600112233), si lo hay. */
  whatsapp?: string;
  email?: string;
};

/** Los datos de la ficha que hacen falta para mandar el enlace. La RLS decide si es de esta agencia. */
async function fichaParaEnlace(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_billing_profiles")
    .select("razon_social, email, telefono")
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

/** 600 11 22 33 → 34600112233. Si no parece un móvil español, se deja tal cual (solo dígitos). */
function telefonoWhatsapp(telefono: string): string | undefined {
  const digitos = telefono.replace(/\D/g, "").replace(/^00/, "");
  if (!digitos) return undefined;
  return digitos.length === 9 ? `34${digitos}` : digitos;
}

/**
 * Enlace para que el cliente firme la domiciliación.
 *
 * Vale 30 días (`lib/enlace-domiciliacion.ts`): sirve para abrirlo delante de
 * él en la visita de alta, para copiarlo en WhatsApp o para mandarlo por
 * correo con `enviarEnlaceDomiciliacion`. También puede firmar desde su panel,
 * en Facturas.
 */
export async function enlaceDomiciliacion(clientId: string): Promise<ResultadoEnlace> {
  await requireAgencia();

  if (!stripeConfigurado()) {
    return { ok: false, mensaje: "Falta STRIPE_SECRET_KEY en el entorno del panel." };
  }

  const ficha = await fichaParaEnlace(clientId);
  if (!ficha) return { ok: false, mensaje: "No se encuentra la ficha de este cliente." };

  const url = `${await urlBase()}/domiciliar/${crearToken(clientId)}`;
  return {
    ok: true,
    mensaje: `Enlace listo. Vale ${DIAS_VALIDEZ_ENLACE} días.`,
    url,
    whatsapp: telefonoWhatsapp(ficha.telefono ?? ""),
    email: ficha.email || undefined,
  };
}

/**
 * Manda el enlace por correo al correo de facturación del cliente.
 *
 * Por Resend y desde el remitente de facturas, igual que `enviarFactura`: quien
 * escribe es la agencia con su dominio.
 */
export async function enviarEnlaceDomiciliacion(
  clientId: string
): Promise<{ ok: boolean; mensaje: string }> {
  await requireAgencia();

  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.FACTURAS_REMITENTE;
  if (!apiKey || !remitente) {
    return {
      ok: false,
      mensaje: "Falta configurar el correo: RESEND_API_KEY y FACTURAS_REMITENTE en el entorno del panel.",
    };
  }

  const enlace = await enlaceDomiciliacion(clientId);
  if (!enlace.ok || !enlace.url) return enlace;
  if (!enlace.email) {
    return {
      ok: false,
      mensaje: "El cliente no tiene correo de facturación. Añádelo en Datos fiscales y guarda.",
    };
  }

  const ficha = await fichaParaEnlace(clientId);
  const nombre = ficha?.razon_social ? ` ${ficha.razon_social}` : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#222;max-width:560px">
      <p>Hola${nombre},</p>
      <p>Para que las cuotas mensuales se paguen solas, sin tener que hacer una transferencia cada mes, solo falta domiciliarlas.</p>
      <p>Pulsa el botón, escribe tu IBAN y acepta la orden de domiciliación. Es una página segura de Stripe, la pasarela con la que cobramos. Te lleva un minuto.</p>
      <p style="margin:24px 0"><a href="${enlace.url}" style="background:#B45831;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Domiciliar mis recibos</a></p>
      <p style="color:#666;font-size:13px">Antes de cada cargo te llegará la factura por correo con el importe. El enlace vale ${DIAS_VALIDEZ_ENLACE} días; si caduca, pídenos otro.</p>
      <p style="color:#666;font-size:13px">Cualquier duda, respóndenos a este correo.</p>
    </div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remitente,
        // El remitente puede ser una dirección sin buzón (Resend solo necesita
        // el dominio verificado); las respuestas van al buzón que sí existe.
        reply_to: KIVUK.email,
        to: [enlace.email],
        subject: "Domicilia tus recibos de Kivuk",
        html,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      return { ok: false, mensaje: `Resend respondió ${r.status}. ${detalle.slice(0, 200)}` };
    }
  } catch (e) {
    return { ok: false, mensaje: `No se pudo enviar: ${mensajeDeError(e)}` };
  }

  return { ok: true, mensaje: `Enlace enviado a ${enlace.email}.` };
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
