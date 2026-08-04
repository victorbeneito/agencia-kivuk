#!/usr/bin/env node
/**
 * Pregunta a la base de conocimiento de un cliente lo mismo que preguntaría el
 * bot, y enseña qué fragmentos y qué productos recupera.
 *
 *   node scripts/probar-conocimiento.js "Cesteria Aparici" "¿cuánto tarda el envío?"
 *   node scripts/probar-conocimiento.js "Cesteria Aparici" --bateria preguntas.txt
 *
 * Sirve para ver si el RAG encuentra lo que debe **antes** de ponerlo delante de
 * clientes reales. Una pregunta que devuelve el fragmento equivocado aquí, va a
 * devolver una respuesta equivocada en WhatsApp.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const leerTexto = (ruta) => fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');

function cargarEnv() {
  const env = {};
  for (const linea of leerTexto(path.join(RAIZ, 'app', '.env.local')).split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = cargarEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = env.OPENAI_API_KEY;

async function supabase(ruta, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} en ${ruta}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function embedding(texto) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texto }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return (await res.json()).data[0].embedding;
}

// Mismo filtrado de palabras que el nodo "Preparar búsqueda" del bot: si aquí se
// buscara de otra forma, la prueba no diría nada sobre lo que hará en WhatsApp.
const VACIAS = new Set([
  'cuanto', 'cuanta', 'cuantos', 'cuantas', 'cuesta', 'cuestan', 'precio',
  'precios', 'vale', 'valen', 'tiene', 'tienen', 'teneis', 'hola', 'buenas',
  'gracias', 'quiero', 'queria', 'necesito', 'busco', 'buscaba', 'sobre',
  'para', 'como', 'donde', 'porque', 'puedo', 'puede', 'pueden', 'hacer',
  'decir', 'saber', 'favor', 'euros', 'envio', 'envios', 'pedido', 'tienda',
  'producto', 'productos', 'algun', 'alguna', 'tambien', 'mucho', 'mucha',
  'sois', 'estais', 'venden', 'vendeis', 'comprar', 'pagar', 'esta', 'este',
  'unas', 'unos', 'otra', 'otro', 'cual', 'cuales', 'vuestro', 'vuestra',
]);

const terminosDe = (pregunta) =>
  [...new Set(
    pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length >= 4 && !VACIAS.has(p))
      .map((p) => { const raiz = p.replace(/(es|s)$/, ""); return raiz.length >= 4 ? raiz : p; })
      .filter((p) => !VACIAS.has(p))
  )].slice(0, 5);

async function preguntar(clientId, pregunta) {
  const emb = await embedding(pregunta);

  const fragmentos = await supabase('rpc/match_knowledge', {
    method: 'POST',
    body: JSON.stringify({ p_client_id: clientId, p_embedding: emb, p_match_count: 5, p_min_similarity: 0.2 }),
  });

  const terminos = terminosDe(pregunta);
  const productos = terminos.length
    ? await supabase('rpc/buscar_productos', {
        method: 'POST',
        body: JSON.stringify({ p_client_id: clientId, p_terminos: terminos, p_limite: 4 }),
      })
    : [];

  console.log('\n──────────────────────────────────────────────');
  console.log('P: ' + pregunta);

  if (!fragmentos.length) {
    console.log('   ⚠ NINGÚN fragmento supera el umbral. El bot responderá que no lo sabe.');
  } else {
    for (const f of fragmentos) {
      console.log(`   ${f.similarity.toFixed(3)}  [${f.category}] ${f.title}`);
    }
  }

  if (terminos.length) {
    console.log('   términos de catálogo: ' + terminos.join(', '));
    if (!productos.length) console.log('   (ningún producto coincide)');
    for (const p of productos) console.log(`     · ${p.name} — ${p.price} ${p.currency}`);
  }
}

async function main() {
  const [nombreCliente, ...resto] = process.argv.slice(2);
  if (!nombreCliente || !resto.length) {
    console.error('uso: node scripts/probar-conocimiento.js "<cliente>" "<pregunta>"');
    console.error('     node scripts/probar-conocimiento.js "<cliente>" --bateria <archivo.txt>');
    process.exit(1);
  }

  const clientes = await supabase(`clients?name=ilike.${encodeURIComponent(nombreCliente)}&select=id,name`);
  if (clientes.length !== 1) throw new Error(`esperaba un cliente llamado "${nombreCliente}", encontré ${clientes.length}`);

  const preguntas =
    resto[0] === '--bateria'
      ? leerTexto(path.resolve(RAIZ, resto[1])).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      : [resto.join(' ')];

  console.log(`cliente: ${clientes[0].name}   ${preguntas.length} pregunta(s)`);
  for (const p of preguntas) await preguntar(clientes[0].id, p);
  console.log('');
}

main().catch((e) => {
  console.error('\nERROR: ' + e.message);
  process.exit(1);
});
