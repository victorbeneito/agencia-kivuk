#!/usr/bin/env node
/**
 * Enciende un número de WhatsApp en la Cloud API.
 *
 * Son dos cosas que la interfaz de Meta presenta juntas y en realidad son
 * independientes, y las dos hacen falta:
 *
 *   1. **Registrar** el número. Verificarlo por SMS solo demuestra que es tuyo;
 *      hasta que se registra, `status` es `PENDING`, el número no existe en
 *      WhatsApp (escribirle dice que no tiene cuenta) y ni siquiera deja subir
 *      la foto de perfil.
 *   2. **Suscribir la app** a la cuenta de WhatsApp Business. Sin esto Meta no
 *      entrega los webhooks: el número queda registrado, todo se ve verde y no
 *      llega un solo mensaje a n8n. Es el fallo más caro de diagnosticar porque
 *      no da ningún error en ninguna parte.
 *
 * Existe porque la interfaz de Meta falla con un error genérico que no explica
 * nada — pasó con el número de la propia agencia — y por esta vía se ve el
 * motivo real que devuelve la API.
 *
 * Uso:
 *   node scripts/registrar-numero-whatsapp.js <phone_number_id> <pin> [waba_id]
 *
 * El PIN son 6 dígitos que eliges tú: es la verificación en dos pasos del
 * número. Apúntalo, hace falta si algún día hay que volver a registrarlo.
 *
 * El token sale de la ficha del cliente en Supabase (el permanente del usuario
 * del sistema, el mismo para todos los clientes de la agencia).
 */

const fs = require("fs");
const path = require("path");

const VERSION = process.env.META_API_VERSION || "v25.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const RAIZ = path.join(__dirname, "..");

/** Lee un .env sencillo sin depender de dotenv. */
function leerEnv(ruta) {
  if (!fs.existsSync(ruta)) return {};
  const salida = {};
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const i = limpia.indexOf("=");
    if (i === -1) continue;
    salida[limpia.slice(0, i).trim()] = limpia
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return salida;
}

async function meta(ruta, cuerpo, token) {
  const r = await fetch(`${GRAPH}${ruta}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });
  return { ok: r.ok, cuerpo: await r.json().catch(() => ({})) };
}

async function main() {
  const [numeroId, pin, wabaId] = process.argv.slice(2);

  if (!numeroId || !pin) {
    console.error("Uso: node scripts/registrar-numero-whatsapp.js <phone_number_id> <pin> [waba_id]");
    process.exit(1);
  }
  if (!/^\d{6}$/.test(pin)) {
    console.error("El PIN son exactamente 6 dígitos.");
    process.exit(1);
  }

  const env = { ...leerEnv(path.join(RAIZ, "n8n", ".env")), ...process.env };
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en n8n/.env");
    process.exit(1);
  }

  // El token permanente es el mismo para toda la agencia: se coge de la primera
  // ficha que lo tenga puesto, en vez de pedirlo por parámetro y que acabe en
  // el historial de la terminal.
  const filas = await (
    await fetch(`${url}/rest/v1/client_modules?module=eq.whatsapp&select=config`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
  ).json();

  const token = (filas || [])
    .map((f) => f.config && f.config.access_token)
    .find((t) => t && t.length > 50);

  if (!token) {
    console.error("Ningún cliente tiene un access_token de WhatsApp guardado.");
    process.exit(1);
  }

  console.log(`Graph API ${VERSION}\n`);

  console.log(`1. Registrando el número ${numeroId}…`);
  const reg = await meta(
    `/${numeroId}/register`,
    { messaging_product: "whatsapp", pin },
    token
  );

  if (reg.ok && reg.cuerpo.success) {
    console.log("   ✓ registrado\n");
  } else {
    const e = reg.cuerpo.error || {};
    // 133005 = el número ya estaba registrado con otro PIN. No es un fallo del
    // proceso: es que alguien lo registró antes y hay que usar aquel PIN.
    const yaEstaba = e.code === 133005 || /already registered/i.test(e.message || "");
    console.log(`   ${yaEstaba ? "•" : "✗"} ${e.message || JSON.stringify(reg.cuerpo)}`);
    if (e.error_user_msg) console.log(`     ${e.error_user_msg}`);
    if (!yaEstaba) {
      console.log("\n   No se sigue: sin registrar, suscribir la app no sirve de nada.");
      process.exit(1);
    }
    console.log("");
  }

  if (!wabaId) {
    console.log("2. Suscripción de la app: omitida (no se pasó waba_id).");
    console.log("   Sin ella los mensajes no llegan a n8n. Vuelve a lanzarlo con el id de la cuenta.");
    return;
  }

  console.log(`2. Suscribiendo la app a la cuenta ${wabaId}…`);
  const sub = await meta(`/${wabaId}/subscribed_apps`, {}, token);

  if (sub.ok && sub.cuerpo.success) {
    console.log("   ✓ suscrita\n");
  } else {
    const e = sub.cuerpo.error || {};
    console.log(`   ✗ ${e.message || JSON.stringify(sub.cuerpo)}`);
    process.exit(1);
  }

  // Comprobar en vez de dar por hecho: los dos pasos anteriores pueden devolver
  // success y dejar el número en PENDING si Meta lo pone en cola.
  console.log("3. Comprobando cómo quedó…");
  const estado = await (
    await fetch(
      `${GRAPH}/${numeroId}?fields=display_phone_number,verified_name,status,code_verification_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  ).json();
  console.log("   ", JSON.stringify(estado));

  const apps = await (
    await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  console.log("   ", JSON.stringify(apps.data || apps));

  if (estado.status === "CONNECTED") {
    console.log("\nListo. El número ya puede recibir y enviar mensajes.");
  } else {
    console.log(`\nOjo: status sigue en ${estado.status}. Espera un minuto y vuelve a mirarlo.`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
