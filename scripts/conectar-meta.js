#!/usr/bin/env node
/**
 * Conecta una cuenta de Instagram/Facebook a un cliente de la plataforma.
 *
 * Hace de puente entre lo que se consigue a mano en el panel de Meta (un token
 * de usuario que dura una hora) y lo que necesita el workflow de publicación
 * (un token de página que no caduca, más los IDs de la cuenta).
 *
 * Uso:
 *   node scripts/conectar-meta.js                    # solo diagnostica
 *   node scripts/conectar-meta.js --guardar <client_id>
 *
 * Lee las credenciales de `n8n/.env` (que está en .gitignore). Ponlas ahí y no
 * en la línea de comandos: el historial de la terminal se guarda en claro.
 *
 *   META_APP_ID=...
 *   META_APP_SECRET=...
 *   META_USER_TOKEN=...   <- el token corto del Explorador de la API
 */

const fs = require("fs");
const path = require("path");

// v26.0 salió el 29/07/2026, dos días antes de escribir esto. Se fija la v25.0
// (18/02/2026, soportada hasta julio de 2028) porque estrenar una versión recién
// publicada en algo que publica en la cuenta real de un cliente no compensa.
// Se puede subir con META_API_VERSION cuando la v26 lleve rodaje.
const VERSION = process.env.META_API_VERSION || "v25.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

const RAIZ = path.join(__dirname, "..");

/** Lee un .env sencillo sin depender de dotenv (esto se ejecuta a pelo). */
function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  const valores = {};
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    valores[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return valores;
}

/**
 * Un token nunca se imprime entero: si esta salida acaba en un pantallazo, en
 * un pegado de chat o en un log, sigue siendo una llave para publicar.
 */
const huella = (t) =>
  !t ? "(vacío)" : `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} caracteres)`;

async function graph(ruta, params) {
  const url = new URL(GRAPH + ruta);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let r;
  try {
    r = await fetch(url);
  } catch (e) {
    // `fetch failed` a secas no dice nada: el motivo real (DNS, certificado,
    // proxy, conexión rechazada) viaja en `cause` y hay que sacarlo a mano.
    const c = e.cause || {};
    throw new Error(
      `no se pudo conectar con ${url.host}: ${c.code || c.message || e.message}` +
        (c.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || c.code === "SELF_SIGNED_CERT_IN_CHAIN"
          ? " — parece un antivirus o proxy que intercepta HTTPS"
          : "")
    );
  }

  const cuerpo = await r.json().catch(() => ({}));

  if (!r.ok || cuerpo.error) {
    const e = cuerpo.error || {};
    // El mensaje de Meta suele ser lo único útil; el resto del objeto estorba.
    throw new Error(
      `${ruta} -> HTTP ${r.status}: ${e.message || JSON.stringify(cuerpo)}` +
        (e.code ? ` [code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}]` : "")
    );
  }
  return cuerpo;
}

const fecha = (seg) =>
  !seg ? "no caduca" : new Date(seg * 1000).toISOString().slice(0, 16).replace("T", " ");

async function main() {
  const env = { ...leerEnv(path.join(RAIZ, "n8n", ".env")), ...process.env };

  const faltan = ["META_APP_ID", "META_APP_SECRET", "META_USER_TOKEN"].filter((k) => !env[k]);
  if (faltan.length) {
    console.error(`Faltan en n8n/.env: ${faltan.join(", ")}`);
    console.error("Mira docs/conectar-meta.md para saber de dónde sale cada uno.");
    process.exit(1);
  }

  console.log(`Graph API ${VERSION}\n`);

  // === 1. Token corto -> token largo ===
  // El del Explorador dura una hora. Sin este canje, todo lo que montes deja de
  // funcionar mientras comes.
  console.log("1. Canjeando el token de una hora por uno de 60 días…");
  const largo = await graph("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: env.META_USER_TOKEN,
  });
  const tokenUsuario = largo.access_token;
  console.log(`   ok  ${huella(tokenUsuario)}\n`);

  // === 2. Qué permisos lleva de verdad ===
  // Marcar las casillas en el Explorador no garantiza que el permiso se haya
  // concedido. Esto pregunta qué hay realmente en el token.
  console.log("2. Comprobando permisos…");
  const info = await graph("/debug_token", {
    input_token: tokenUsuario,
    access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}`,
  });
  const d = info.data || {};
  const concedidos = new Set(d.scopes || []);

  const NECESARIOS = [
    ["instagram_basic", "leer la cuenta de Instagram"],
    ["instagram_content_publish", "publicar en Instagram"],
    ["pages_show_list", "ver tus páginas"],
    ["pages_read_engagement", "leer la página"],
    ["pages_manage_posts", "publicar en Facebook"],
  ];

  console.log(`   app ${d.app_id}   caduca: ${fecha(d.expires_at)}`);
  let incompleto = false;
  for (const [permiso, para] of NECESARIOS) {
    const tiene = concedidos.has(permiso);
    if (!tiene) incompleto = true;
    console.log(`   ${tiene ? "✓" : "✗"} ${permiso.padEnd(28)} ${para}`);
  }
  if (incompleto) {
    console.log("\n   Vuelve al Explorador, marca los que faltan y genera el token otra vez.");
  }
  console.log();

  // === 3. Páginas y sus cuentas de Instagram ===
  console.log("3. Buscando páginas y cuentas de Instagram…");
  const cuentas = await graph("/me/accounts", {
    access_token: tokenUsuario,
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });

  const paginas = cuentas.data || [];
  const encontradas = [];

  // Tener el permiso y tener activos concedidos son cosas distintas: con el
  // inicio de sesión para empresas cada permiso se concede sobre activos
  // concretos, y `granular_scopes` dice cuáles. Distingue "no tienes el
  // permiso" de "lo tienes pero sobre cero páginas", que es un fallo mucho más
  // común y se diagnostica fatal desde fuera.
  const granular = d.granular_scopes || [];
  const activosDe = (scope) => {
    const g = granular.find((x) => x.scope === scope);
    return (g && g.target_ids) || [];
  };

  if (!paginas.length) {
    console.log("   Ninguna página.\n");

    if (concedidos.has("pages_show_list") && !activosDe("pages_show_list").length) {
      console.log("   pages_show_list está concedido pero SIN NINGUNA PÁGINA: al autorizar");
      console.log("   la app no se marcó ninguna en la pantalla de páginas. Facebook se");
      console.log("   queda sin conectar; Instagram puede funcionar igualmente.\n");
      console.log("   Para arreglarlo: quita la app en facebook.com/settings?tab=business_tools");
      console.log("   y vuelve a generar el token marcando la página.\n");
    } else {
      console.log("   Tu usuario no administra ninguna página con esta app.\n");
    }

    // Instagram no depende de la página: si el permiso de publicar está
    // concedido sobre la cuenta, el propio token de usuario sirve para
    // publicar. Comprobado contra la API, no deducido de la documentación
    // (que dice que hace falta un token de página).
    const cuentasIg = activosDe("instagram_content_publish");
    for (const igId of cuentasIg) {
      const perfil = await graph(`/${igId}`, {
        access_token: tokenUsuario,
        fields: "id,username,name",
      });
      console.log(`   Instagram @${perfil.username} (${perfil.name || "sin nombre"}) sí está concedida.`);
      encontradas.push({
        platform: "instagram",
        external_id: perfil.id,
        username: perfil.username,
        access_token: tokenUsuario,
        // Este token SÍ caduca, a diferencia del de página. Se guarda la fecha
        // para que se pueda avisar antes de que deje de publicar.
        expira: d.expires_at || null,
        meta: { origen: "token de usuario", sin_pagina: true },
      });
    }

    if (!encontradas.length) {
      console.log("   Y tampoco hay ninguna cuenta de Instagram concedida. No hay nada que guardar.");
      process.exit(1);
    }
  }

  for (const p of paginas) {
    const ig = p.instagram_business_account;
    console.log(`\n   Página «${p.name}»`);
    console.log(`     page_id      ${p.id}`);
    console.log(`     token        ${huella(p.access_token)}`);
    if (ig) {
      console.log(`     instagram    @${ig.username}  (ig_user_id ${ig.id})`);
    } else {
      console.log("     instagram    sin vincular  <- la cuenta debe ser profesional");
      console.log("                  y estar enlazada a esta página desde la app de Instagram");
    }

    encontradas.push({ platform: "facebook", external_id: p.id, username: p.name, access_token: p.access_token });
    if (ig) {
      // El token para publicar en Instagram es el de la PÁGINA, no uno propio
      // de Instagram. Es el detalle que más tiempo hace perder.
      encontradas.push({
        platform: "instagram",
        external_id: ig.id,
        username: ig.username,
        access_token: p.access_token,
        meta: { page_id: p.id, page_name: p.name },
      });
    }
  }

  // === 4. Guardar ===
  const iGuardar = process.argv.indexOf("--guardar");
  const clientId = iGuardar > -1 ? process.argv[iGuardar + 1] : null;

  if (!clientId) {
    console.log("\n\nDiagnóstico terminado, no se ha guardado nada.");
    console.log("Para guardarlo:  node scripts/conectar-meta.js --guardar <client_id>");
    return;
  }

  if (incompleto) {
    console.error("\n\nNo se guarda: faltan permisos y el token no serviría para publicar.");
    process.exit(1);
  }

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("\nFaltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en n8n/.env");
    process.exit(1);
  }

  console.log(`\n\n4. Guardando ${encontradas.length} cuentas para el cliente ${clientId}…`);
  const filas = encontradas.map((c) => ({
    client_id: clientId,
    platform: c.platform,
    external_id: c.external_id,
    username: c.username,
    access_token: c.access_token,
    // Los tokens de página no caducan por tiempo: ahí va null a propósito. Los
    // de usuario (los que se guardan cuando no hay página concedida) sí duran
    // 60 días, y esa fecha hay que conservarla o el día que dejen de publicar
    // no habrá forma de saber por qué.
    token_expires_at: c.expira ? new Date(c.expira * 1000).toISOString() : null,
    last_checked_at: new Date().toISOString(),
    meta: c.meta || {},
    updated_at: new Date().toISOString(),
  }));

  const r = await fetch(
    `${url}/rest/v1/social_accounts?on_conflict=client_id,platform,external_id`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(filas),
    }
  );

  const guardadas = await r.json();
  if (!r.ok) {
    console.error(`   Error ${r.status}: ${JSON.stringify(guardadas)}`);
    process.exit(1);
  }

  for (const g of guardadas) {
    console.log(`   ✓ ${g.platform.padEnd(9)} ${g.username || g.external_id}`);
  }
  console.log("\nListo. El workflow de publicación ya puede usar estas cuentas.");
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
