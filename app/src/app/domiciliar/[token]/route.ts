import { NextResponse } from "next/server";

import { leerToken } from "@/lib/enlace-domiciliacion";
import { crearSesionDomiciliacion, mensajeDeError, urlBase } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * El enlace que recibe el cliente por correo o por WhatsApp.
 *
 * No es la página de Stripe: esa caduca a las 24 horas. Esto comprueba el token
 * (ver `lib/enlace-domiciliacion.ts`), crea la sesión de Stripe en ese momento
 * y redirige a ella. Se puede abrir cuantas veces haga falta mientras el token
 * no caduque.
 *
 * Público y sin sesión, como la página de vuelta: lo abre el cliente desde su
 * móvil. Quien decide de qué cliente es el enlace es la firma del token, no
 * quien lo abre; por eso se escribe con `service_role`.
 *
 * Los previsualizadores de enlaces (WhatsApp, el antivirus del correo) también
 * hacen GET aquí. No pasa nada: cada visita crea una sesión de Stripe que nadie
 * usa y caduca sola, y el cliente de Stripe se crea una sola vez por cliente.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = await urlBase();

  const clientId = leerToken(token);
  if (!clientId) {
    return NextResponse.redirect(`${base}/domiciliacion?domiciliacion=caducado`, 303);
  }

  try {
    const url = await crearSesionDomiciliacion(createServiceRoleClient(), clientId, "/domiciliacion");
    return NextResponse.redirect(url, 303);
  } catch (e) {
    console.error("domiciliar:", clientId, mensajeDeError(e));
    return NextResponse.redirect(`${base}/domiciliacion?domiciliacion=error`, 303);
  }
}
