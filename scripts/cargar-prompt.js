#!/usr/bin/env node
/**
 * Sube el prompt de un cliente desde su documento de `docs/` a `agent_configs`.
 *
 * Existe porque copiar y pegar el prompt a mano ha fallado tres veces, y las
 * tres de forma silenciosa:
 *
 *   - En Kivuk se pegó el markdown entero, incluida la sección «Decisiones
 *     tomadas al redactarlo», que el modelo leyó como instrucciones.
 *   - En Cestería se colaron las comillas de cierre del bloque (```) al final
 *     del prompt.
 *   - Y en las credenciales, el volcado de una terminal de otro proyecto.
 *
 * Ninguna de las tres da error: el prompt se guarda, el bot responde, y lo que
 * se nota es un comportamiento raro semanas después. El fichero de `docs/` ya
 * es la versión buena y versionada; esto lo lleva a la base de datos sin que
 * intervenga el portapapeles.
 *
 * Del documento se coge SOLO el contenido del primer bloque ``` que empiece por
 * `[`. Todo lo que hay alrededor —el título, la explicación de por qué está
 * redactado así, las decisiones— se queda fuera, que es justo lo que se pegaba
 * de más.
 *
 * Uso:
 *   node scripts/cargar-prompt.js docs/prompt-cesteria-aparici.md "Cesteria Aparici"
 *   node scripts/cargar-prompt.js docs/prompt-cesteria-aparici.md "Cesteria Aparici" --aplicar
 *
 * Sin `--aplicar` no escribe: enseña qué subiría y qué cambia respecto a lo que
 * ya hay. Mismo criterio que `cargar-conocimiento.js`.
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

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

/**
 * Saca el prompt del documento: el primer bloque cercado cuyo contenido empiece
 * por `[`, que es como abren todos los prompts de este repo (`[ROL]`).
 *
 * Se exige ese `[` para no coger por error un bloque de ejemplo de JSON o de
 * comandos que aparezca antes en el documento.
 */
function extraerPrompt(markdown) {
  const bloques = [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)];
  for (const b of bloques) {
    const cuerpo = b[1].trim();
    if (cuerpo.startsWith("[")) return cuerpo;
  }
  return null;
}

async function main() {
  const [ruta, nombreCliente, ...resto] = process.argv.slice(2);
  const aplicar = resto.includes("--aplicar");

  if (!ruta || !nombreCliente) {
    console.error('Uso: node scripts/cargar-prompt.js <fichero.md> "<nombre del cliente>" [--aplicar]');
    process.exit(1);
  }

  const absoluta = path.isAbsolute(ruta) ? ruta : path.join(RAIZ, ruta);
  if (!fs.existsSync(absoluta)) {
    console.error(`No existe ${ruta}`);
    process.exit(1);
  }

  const prompt = extraerPrompt(fs.readFileSync(absoluta, "utf8"));
  if (!prompt) {
    console.error(
      "No se ha encontrado ningún bloque ``` que empiece por «[» en ese documento."
    );
    process.exit(1);
  }

  // Comprobaciones sobre lo que se va a subir. Son exactamente los tres errores
  // que se han colado antes por pegarlo a mano.
  const avisos = [];
  if (prompt.includes("```")) avisos.push("lleva comillas de bloque (```) dentro");
  if (/^#{1,6}\s/m.test(prompt)) avisos.push("lleva títulos de markdown (#), que suelen ser comentarios del documento");
  if (prompt.length < 200) avisos.push("es sospechosamente corto");

  const env = { ...leerEnv(path.join(RAIZ, "n8n", ".env")), ...process.env };
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en n8n/.env");
    process.exit(1);
  }
  const cabeceras = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const clientes = await (
    await fetch(
      `${url}/rest/v1/clients?name=eq.${encodeURIComponent(nombreCliente)}&select=id,name`,
      { headers: cabeceras }
    )
  ).json();

  if (!clientes.length) {
    console.error(`No hay ningún cliente que se llame «${nombreCliente}».`);
    process.exit(1);
  }
  const cliente = clientes[0];

  const configs = await (
    await fetch(
      `${url}/rest/v1/agent_configs?client_id=eq.${cliente.id}&select=id,name,system_prompt`,
      { headers: cabeceras }
    )
  ).json();

  const actual = configs[0];

  console.log(`Cliente: ${cliente.name}`);
  console.log(`Fichero: ${ruta}`);
  console.log(`Prompt : ${prompt.length} caracteres, ${prompt.split("\n").length} líneas`);
  console.log(`         empieza por «${prompt.split("\n")[0]}»`);
  console.log(`         acaba en   «${prompt.split("\n").slice(-1)[0]}»`);

  if (avisos.length) {
    console.log("\n⚠ Revisa esto antes de subirlo:");
    for (const a of avisos) console.log(`   - El prompt ${a}.`);
  }

  if (!actual) {
    console.log("\nEl cliente no tiene ninguna configuración de agente todavía: se creará una.");
  } else if (actual.system_prompt === prompt) {
    console.log("\nYa está subido exactamente este prompt. No hay nada que hacer.");
    return;
  } else {
    const antes = (actual.system_prompt || "").length;
    console.log(`\nSustituye el prompt actual (${antes} caracteres → ${prompt.length}).`);
  }

  if (!aplicar) {
    console.log("\nSimulacro: no se ha escrito nada. Añade --aplicar para subirlo.");
    return;
  }

  const destino = actual
    ? `${url}/rest/v1/agent_configs?id=eq.${actual.id}`
    : `${url}/rest/v1/agent_configs`;

  const r = await fetch(destino, {
    method: actual ? "PATCH" : "POST",
    headers: { ...cabeceras, Prefer: "return=representation" },
    body: JSON.stringify(
      actual
        ? { system_prompt: prompt, updated_at: new Date().toISOString() }
        : { client_id: cliente.id, name: "Bot principal", system_prompt: prompt }
    ),
  });

  if (!r.ok) {
    console.error(`\nNo se pudo guardar: HTTP ${r.status} ${await r.text()}`);
    process.exit(1);
  }

  // Leer de vuelta en vez de fiarse del 200: es la costumbre del proyecto.
  const [guardado] = await r.json();
  console.log(
    guardado.system_prompt === prompt
      ? "\n✓ Subido y comprobado: lo guardado coincide con el fichero."
      : "\n✗ Se guardó algo distinto de lo que se envió. Míralo en el panel."
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
