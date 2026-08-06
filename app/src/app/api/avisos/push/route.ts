import { NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Envía una notificación push a todos los dispositivos de un cliente.
 *
 * Lo llama n8n cuando alguien pide hablar con una persona. Vive en el panel y no
 * en un nodo de n8n porque firmar un envío push es criptografía (ECDSA sobre la
 * clave VAPID) y eso, en un nodo Code, es cien líneas frágiles; aquí es una
 * librería.
 *
 * Necesita el runtime de Node: `web-push` usa el módulo `crypto`, que no existe
 * en el runtime edge.
 */
export const runtime = "nodejs";

type Cuerpo = {
  client_id?: string;
  titulo?: string;
  cuerpo?: string;
  url?: string;
  tag?: string;
};

export async function POST(request: Request) {
  // Mismo secreto que el webhook de envío de WhatsApp. Sin él, cualquiera que
  // dé con la URL puede mandar notificaciones al móvil de un cliente.
  const esperado = process.env.N8N_WEBHOOK_TOKEN;
  if (!esperado || request.headers.get("x-kivuk-token") !== esperado) {
    return NextResponse.json(
      { ok: false, mensaje: "Petición no autorizada." },
      { status: 401 }
    );
  }

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;

  if (!publica || !privada) {
    return NextResponse.json(
      { ok: false, mensaje: "Faltan las claves VAPID en la configuración." },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(
    // El servicio de push exige un contacto por si hay que avisar de abusos.
    process.env.VAPID_SUBJECT || "mailto:info@agenciakivuk.com",
    publica,
    privada
  );

  const datos = (await request.json().catch(() => null)) as Cuerpo | null;

  if (!datos?.client_id) {
    return NextResponse.json(
      { ok: false, mensaje: "Falta client_id." },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();

  const [{ data: ajustes }, { data: dispositivos }] = await Promise.all([
    admin
      .from("client_notification_settings")
      .select("push")
      .eq("client_id", datos.client_id)
      .maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("client_id", datos.client_id),
  ]);

  // Se comprueba aquí y no en n8n: la preferencia puede cambiar entre que el
  // workflow la leyó y este momento, y además así vale para cualquier otro
  // sitio que quiera mandar un aviso.
  if (!ajustes?.push) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "desactivado" });
  }

  if (!dispositivos?.length) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "sin dispositivos" });
  }

  const carga = JSON.stringify({
    titulo: datos.titulo || "Kivuk",
    cuerpo: datos.cuerpo || "",
    url: datos.url || "/panel/conversaciones",
    tag: datos.tag || "kivuk-aviso",
  });

  let enviados = 0;
  const caducados: string[] = [];

  await Promise.all(
    dispositivos.map(async (d) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: d.endpoint,
            keys: { p256dh: d.p256dh, auth: d.auth },
          },
          carga,
          { TTL: 3600 }
        );
        enviados++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;

        // 404 y 410 significan que ese dispositivo ya no existe: la app se
        // desinstaló o se limpiaron los datos. Guardarlo para siempre es
        // acumular basura y reintentos que nunca van a funcionar.
        if (codigo === 404 || codigo === 410) {
          caducados.push(d.id);
        } else {
          await admin
            .from("push_subscriptions")
            .update({ fallos: 1 })
            .eq("id", d.id);
        }
      }
    })
  );

  if (caducados.length) {
    await admin.from("push_subscriptions").delete().in("id", caducados);
  }

  if (enviados) {
    // Los caducados ya se han borrado arriba, así que aquí solo quedan los que
    // siguen vivos.
    await admin
      .from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString(), fallos: 0 })
      .eq("client_id", datos.client_id);
  }

  return NextResponse.json({
    ok: true,
    enviados,
    retirados: caducados.length,
  });
}
