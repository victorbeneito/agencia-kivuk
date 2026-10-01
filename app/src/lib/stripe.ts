import Stripe from "stripe";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Stripe como pasarela de la domiciliación SEPA. Solo servidor.
 *
 * Stripe cobra, no factura: las facturas siguen saliendo del panel con su
 * numeración (0013) y aquí solo se pasa al banco del cliente el total de una
 * factura ya emitida. Por eso no se usan Stripe Billing ni sus suscripciones,
 * que generarían una segunda serie de facturas que no sabe nada de la nuestra
 * (y cobran un porcentaje aparte por ello).
 *
 * Las piezas, en el orden en que se usan:
 *
 *   1. `crearSesionDomiciliacion` — el cliente abre una página de Stripe, pone
 *      su IBAN y acepta la orden de domiciliación. Stripe guarda el mandato.
 *   2. El webhook (`/api/stripe/webhook`) apunta en la ficha del cliente el
 *      método de pago y el mandato.
 *   3. `cobrarFactura` — cada mes, al cobrar una factura emitida y ya avisada,
 *      se lanza un cargo por su total contra ese mandato.
 *   4. El webhook marca la factura como pagada cuando el banco confirma, o
 *      apunta el fallo o la devolución.
 */

let cliente: Stripe | null = null;

/** El cliente de Stripe, o null si falta la clave: las pantallas lo avisan en vez de romper. */
export function stripe(): Stripe | null {
  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave) return null;
  cliente ??= new Stripe(clave, {
    appInfo: { name: "Kivuk panel" },
    // Un reintento cubre el corte de red puntual; con la idempotency key de
    // cada llamada, reintentar no duplica un cargo.
    maxNetworkRetries: 2,
  });
  return cliente;
}

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Con qué dirección vuelve el cliente desde la página de Stripe.
 *
 * `PANEL_URL` si está; si no, la de la propia petición. Detrás de Caddy el
 * `host` es el público y el protocolo llega en `x-forwarded-proto`.
 */
async function urlBase(): Promise<string> {
  if (process.env.PANEL_URL) return process.env.PANEL_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Céntimos: Stripe no trabaja con decimales. */
export function aCentimos(euros: number): number {
  return Math.round(Number(euros) * 100);
}

/** El mensaje de un error de Stripe, sin la traza. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof Stripe.errors.StripeError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

/**
 * El `Customer` de Stripe de un cliente, creándolo la primera vez.
 *
 * Recibe el cliente de Supabase con el que escribir: desde el panel de la
 * agencia es el suyo (la RLS le deja escribir la ficha fiscal); desde el panel
 * del cliente tiene que ser `service_role`, porque el cliente final no escribe
 * su ficha y la comprobación de permisos ya se ha hecho antes.
 */
async function asegurarCustomer(
  s: Stripe,
  db: SupabaseClient,
  clientId: string
): Promise<string> {
  const { data: perfil } = await db
    .from("client_billing_profiles")
    .select("razon_social, email, telefono, stripe_customer_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (perfil?.stripe_customer_id) return perfil.stripe_customer_id;

  const { data: c } = await db.from("clients").select("name").eq("id", clientId).single();

  const customer = await s.customers.create(
    {
      name: perfil?.razon_social || c?.name || undefined,
      email: perfil?.email || undefined,
      phone: perfil?.telefono || undefined,
      preferred_locales: ["es"],
      metadata: { client_id: clientId },
    },
    // Dos clics seguidos no crean dos clientes en Stripe. La clave dura 24 h,
    // de sobra para cubrir la carrera; después ya está guardado aquí.
    { idempotencyKey: `customer-${clientId}` }
  );

  const { error } = await db
    .from("client_billing_profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("client_id", clientId);

  if (error) throw new Error(`No se pudo guardar el cliente de Stripe: ${error.message}`);
  return customer.id;
}

/**
 * La página de Stripe donde el cliente pone su IBAN y firma la orden.
 *
 * Es un Checkout en modo `setup`: no cobra nada, solo deja el mandato guardado
 * para los cargos de los meses siguientes. El texto de la orden lo pone Stripe
 * (es el que exige la norma SEPA, e incluye que los avisos de cargo pueden
 * llegar hasta 2 días antes) y el mandato queda a nombre de Stripe como
 * acreedor, por eso Kivuk no necesita su propio identificador de acreedor.
 *
 * El enlace caduca a las 24 horas: es para abrirlo en el momento, no para
 * mandarlo y olvidarse.
 */
export async function crearSesionDomiciliacion(
  db: SupabaseClient,
  clientId: string,
  volverA: string
): Promise<string> {
  const s = stripe();
  if (!s) throw new Error("Falta STRIPE_SECRET_KEY en el entorno del panel.");

  const customer = await asegurarCustomer(s, db, clientId);
  const base = await urlBase();

  const sesion = await s.checkout.sessions.create({
    mode: "setup",
    customer,
    currency: "eur",
    payment_method_types: ["sepa_debit"],
    locale: "es",
    success_url: `${base}${volverA}${volverA.includes("?") ? "&" : "?"}domiciliacion=ok`,
    cancel_url: `${base}${volverA}`,
    metadata: { client_id: clientId },
    setup_intent_data: { metadata: { client_id: clientId } },
  });

  if (!sesion.url) throw new Error("Stripe no ha devuelto la dirección de la página.");
  return sesion.url;
}

/**
 * Lanza el cargo SEPA de una factura.
 *
 * Un adeudo SEPA no se resuelve en el acto: sale en estado `processing` y el
 * banco del cliente tarda varios días hábiles en pagarlo o rechazarlo. Quien
 * cierra la factura es el webhook, no esta función.
 *
 * `intentoAnterior` entra en la idempotency key: dos clics sobre el mismo
 * intento devuelven el mismo cargo en vez de cobrar dos veces, y un reintento
 * tras un fallo (que ya tiene otro `intentoAnterior`) sí crea uno nuevo.
 */
export async function cobrarFactura(p: {
  facturaId: string;
  numero: string;
  clientId: string;
  total: number;
  customerId: string;
  paymentMethodId: string;
  intentoAnterior: string | null;
}): Promise<Stripe.PaymentIntent> {
  const s = stripe();
  if (!s) throw new Error("Falta STRIPE_SECRET_KEY en el entorno del panel.");

  return s.paymentIntents.create(
    {
      amount: aCentimos(p.total),
      currency: "eur",
      customer: p.customerId,
      payment_method: p.paymentMethodId,
      payment_method_types: ["sepa_debit"],
      confirm: true,
      off_session: true,
      description: `Factura ${p.numero}`,
      metadata: { invoice_id: p.facturaId, client_id: p.clientId, numero: p.numero },
    },
    { idempotencyKey: `cobro-${p.facturaId}-${p.intentoAnterior ?? "primero"}` }
  );
}
