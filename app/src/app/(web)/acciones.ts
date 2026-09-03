"use server";

import { KIVUK } from "@/lib/web/kivuk";

export type Resultado = { ok: boolean; mensaje: string };

/**
 * El formulario de contacto de la web.
 *
 * Manda un correo y nada más: no toca la base de datos. El sitio donde deberían
 * caer estos avisos es el CRM de captación, que todavía no existe (punto 2 de
 * `docs/marketing-y-captacion.md`); cuando exista, esta acción escribirá el lead
 * y seguirá mandando el correo. Mientras tanto, un correo perdido es peor que
 * feo, así que el formulario avisa claramente cuando el envío falla en vez de
 * dar las gracias sin haber enviado nada.
 *
 * Va por Resend directamente, igual que las facturas: el remitente es el dominio
 * de la agencia, que ya está verificado.
 */
export async function enviarConsulta(formData: FormData): Promise<Resultado> {
  // Trampa para robots: es un campo oculto que una persona nunca rellena. Si
  // viene con algo, se responde que todo ha ido bien y no se manda nada — un
  // error le diría al robot qué tiene que cambiar para colarse.
  if (String(formData.get("web") ?? "").trim()) {
    return { ok: true, mensaje: "Recibido. Te escribimos en menos de 24 horas." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const negocio = String(formData.get("negocio") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const mensaje = String(formData.get("mensaje") ?? "").trim();

  if (!nombre || !contacto) {
    return { ok: false, mensaje: "Hace falta al menos tu nombre y cómo localizarte." };
  }

  if (!formData.get("consentimiento")) {
    return { ok: false, mensaje: "Marca la casilla de privacidad para poder escribirte." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  // El remitente puede ser el mismo de facturación: lo que importa es que el
  // dominio esté verificado en Resend, no la dirección concreta.
  const remitente = process.env.CONTACTO_REMITENTE || process.env.FACTURAS_REMITENTE;
  const destinatario = process.env.CONTACTO_DESTINATARIO || KIVUK.email;

  if (!apiKey || !remitente) {
    return {
      ok: false,
      mensaje: `No se ha podido enviar. Escríbenos directamente a ${KIVUK.email}.`,
    };
  }

  const filas = [
    ["Nombre", nombre],
    ["Negocio", negocio],
    ["Contacto", contacto],
  ]
    .filter(([, valor]) => valor)
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666">${etiqueta}</td><td style="padding:4px 0"><strong>${escapar(
          valor
        )}</strong></td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#222;max-width:560px">
      <p>Nueva consulta desde <strong>${KIVUK.dominio}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">${filas}</table>
      ${mensaje ? `<p style="white-space:pre-wrap">${escapar(mensaje)}</p>` : ""}
    </div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [destinatario],
        subject: `Consulta web — ${nombre}${negocio ? ` (${negocio})` : ""}`,
        html,
        // Para poder responder con «Responder» si lo que ha dejado es un correo.
        ...(contacto.includes("@") ? { reply_to: contacto } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!r.ok) {
      return {
        ok: false,
        mensaje: `No se ha podido enviar. Escríbenos a ${KIVUK.email}.`,
      };
    }
  } catch {
    return {
      ok: false,
      mensaje: `No se ha podido enviar. Escríbenos a ${KIVUK.email}.`,
    };
  }

  return { ok: true, mensaje: "Recibido. Te escribimos en menos de 24 horas." };
}

/** El texto lo escribe un desconocido y acaba dentro de un HTML que yo leo. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
