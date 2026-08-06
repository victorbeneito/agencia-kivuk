"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clienteDelPanel, getPerfil } from "@/lib/auth";

/**
 * Alta y baja de un dispositivo para notificaciones push.
 *
 * Lo que se guarda aquí no es una preferencia, es un permiso: el navegador
 * emite una suscripción firmada para *ese* teléfono, y sin ella no hay forma de
 * enviarle nada. Por eso va por dispositivo y no por cliente — quien atiende el
 * WhatsApp desde su móvil y desde la tablet tiene dos.
 */

export type ResultadoPush = { ok: boolean; mensaje?: string };

type Suscripcion = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function registrarDispositivo(
  suscripcion: Suscripcion,
  userAgent: string
): Promise<ResultadoPush> {
  const { clientId } = await clienteDelPanel();
  const perfil = await getPerfil();

  if (!suscripcion?.endpoint || !suscripcion.keys?.p256dh) {
    return { ok: false, mensaje: "El navegador no ha dado una suscripción válida." };
  }

  const admin = createServiceRoleClient();

  // `onConflict` sobre el endpoint: si el mismo dispositivo vuelve a
  // suscribirse —pasa al reinstalar o al cambiar de usuario en el mismo
  // teléfono— se actualiza la fila en vez de duplicarla.
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      client_id: clientId,
      user_id: perfil?.userId ?? null,
      endpoint: suscripcion.endpoint,
      p256dh: suscripcion.keys.p256dh,
      auth: suscripcion.keys.auth,
      user_agent: userAgent.slice(0, 300),
      fallos: 0,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { ok: false, mensaje: error.message };

  // La preferencia y el permiso van juntos: si acabas de dar permiso en este
  // teléfono, es que quieres avisos en el móvil.
  await admin.from("client_notification_settings").upsert(
    { client_id: clientId, push: true, updated_at: new Date().toISOString() },
    { onConflict: "client_id" }
  );

  revalidatePath("/panel/cuenta");
  return { ok: true };
}

export async function olvidarDispositivo(endpoint: string): Promise<ResultadoPush> {
  const { clientId } = await clienteDelPanel();
  const admin = createServiceRoleClient();

  // El `client_id` en el WHERE además del endpoint: aunque el endpoint es
  // único, no está de más no fiarse de un valor que llega del navegador.
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("client_id", clientId);

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel/cuenta");
  return { ok: true };
}

/** ¿Está este endpoint concreto ya dado de alta? Lo pregunta el navegador. */
export async function dispositivoRegistrado(
  endpoint: string
): Promise<boolean> {
  const { clientId } = await clienteDelPanel();
  const admin = createServiceRoleClient();

  const { data } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .eq("client_id", clientId)
    .maybeSingle();

  return Boolean(data);
}
