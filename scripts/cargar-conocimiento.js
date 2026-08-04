#!/usr/bin/env node
/**
 * Carga en la base de conocimiento de un cliente los documentos redactados en
 * un archivo Markdown de `docs/`, generando sus embeddings.
 *
 * Hace exactamente lo mismo que el formulario del panel (mismo troceado, mismo
 * modelo de embeddings); solo evita copiar y pegar catorce veces. Los documentos
 * quedan igual de editables desde la pestaña Conocimiento.
 *
 *   node scripts/cargar-conocimiento.js docs/conocimiento-cesteria-aparici.md "Cesteria Aparici"
 *   node scripts/cargar-conocimiento.js <archivo> <cliente> --aplicar
 *
 * Sin `--aplicar` solo enseña lo que haría. Se relanza las veces que haga falta:
 * un documento que ya existe (mismo título y mismo cliente) se actualiza y se
 * reindexa, no se duplica.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

// Los archivos del repo están con saltos de Windows. En una expresión regular
// de JavaScript, `.` no coincide con `\r`, así que sin normalizar esto ningún
// patrón que termine en `$` casa nada.
const leerTexto = (ruta) => fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');

// --- configuración -------------------------------------------------------
// Las claves salen de app/.env.local, que es donde ya están para el panel.
function cargarEnv() {
  const ruta = path.join(RAIZ, 'app', '.env.local');
  if (!fs.existsSync(ruta)) throw new Error('no encuentro app/.env.local');

  const env = {};
  for (const linea of leerTexto(ruta).split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = cargarEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = env.OPENAI_API_KEY;

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, OPENAI_API_KEY: OPENAI_KEY })) {
  if (!v) throw new Error(`falta ${k} en app/.env.local`);
}

// Las etiquetas legibles del documento se traducen a los valores que acepta la
// restricción de la tabla (ver 0006_rag.sql).
const CATEGORIAS = {
  'la empresa': 'empresa',
  'envíos': 'envio',
  'envios': 'envio',
  'devoluciones': 'devolucion',
  'productos': 'producto',
  'pagos': 'pago',
  'preguntas frecuentes': 'faq',
};

// --- parseo del Markdown -------------------------------------------------
function parsear(md) {
  // La sección de pendientes del final no son documentos.
  const cuerpo = md.split(/^# Pendiente de confirmar/m)[0];
  const docs = [];

  // Cada documento empieza en "## 3. Título" y termina donde empieza el siguiente.
  const trozos = cuerpo.split(/^## \d+\.\s+/m).slice(1);

  for (const trozo of trozos) {
    const title = trozo.split('\n')[0].trim();

    const cat = (trozo.match(/^-\s+\*\*Categoría:\*\*\s*(.+)$/m) || [])[1];
    if (!cat) throw new Error(`"${title}" no declara categoría`);

    const category = CATEGORIAS[cat.trim().toLowerCase()];
    if (!category) throw new Error(`categoría desconocida en "${title}": ${cat}`);

    const url = (trozo.match(/^-\s+\*\*URL de origen:\*\*\s*(\S+)$/m) || [])[1];
    // Los documentos confirmados por el cliente ponen una nota en cursiva ahí.
    const source_url = url && /^https?:\/\//.test(url) ? url : null;

    const bloque = trozo.match(/```\n([\s\S]*?)\n```/);
    if (!bloque) throw new Error(`"${title}" no tiene bloque de contenido`);

    docs.push({ title, category, source_url, content: bloque[1].trim() });
  }

  return docs;
}

// --- troceado (idéntico al del panel) ------------------------------------
const MAX_CHUNK = 1000;
const SOLAPE = 150;
const UMBRAL_TROCEADO = 1200;

function trocear(titulo, contenido) {
  const texto = contenido.trim();
  const encabezar = (t) => `[${titulo}]\n\n${t}`;

  if (texto.length <= UMBRAL_TROCEADO) return [encabezar(texto)];

  const parrafos = texto.split(/\n\s*\n/).filter((p) => p.trim());
  const trozos = [];
  let actual = '';

  for (const parrafo of parrafos) {
    if (actual && actual.length + parrafo.length + 2 > MAX_CHUNK) {
      trozos.push(actual);
      actual = actual.slice(-SOLAPE) + '\n\n' + parrafo;
    } else {
      actual = actual ? `${actual}\n\n${parrafo}` : parrafo;
    }
  }
  if (actual.trim()) trozos.push(actual);

  return trozos.map(encabezar);
}

// --- clientes HTTP -------------------------------------------------------
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

async function embeddings(textos) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: textos }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const json = await res.json();
  return json.data.slice().sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// --- programa ------------------------------------------------------------
async function main() {
  const [archivo, nombreCliente] = process.argv.slice(2);
  const aplicar = process.argv.includes('--aplicar');

  if (!archivo || !nombreCliente) {
    console.error('uso: node scripts/cargar-conocimiento.js <archivo.md> "<nombre del cliente>" [--aplicar]');
    process.exit(1);
  }

  const docs = parsear(leerTexto(path.resolve(RAIZ, archivo)));

  console.log(`${docs.length} documentos en ${archivo}:\n`);
  for (const d of docs) {
    const trozos = trocear(d.title, d.content).length;
    console.log(`  [${d.category.padEnd(10)}] ${d.title}`);
    console.log(`   ${String(d.content.length).padStart(5)} caracteres -> ${trozos} ${trozos === 1 ? 'trozo' : 'trozos'}${d.source_url ? '' : '   (sin URL de origen)'}`);
  }

  // El nombre puede llevar tilde o no; se busca sin distinguir mayúsculas.
  const clientes = await supabase(`clients?name=ilike.${encodeURIComponent(nombreCliente)}&select=id,name`);
  if (!clientes.length) throw new Error(`no hay ningún cliente que se llame "${nombreCliente}"`);
  if (clientes.length > 1) throw new Error(`hay ${clientes.length} clientes con ese nombre; afina el nombre`);

  const cliente = clientes[0];
  console.log(`\ncliente: ${cliente.name}  (${cliente.id})`);

  if (!aplicar) {
    console.log('\nEsto es una simulación. Vuelve a lanzarlo con --aplicar para escribirlo.');
    return;
  }

  const existentes = await supabase(`knowledge_documents?client_id=eq.${cliente.id}&select=id,title`);
  const porTitulo = new Map(existentes.map((d) => [d.title, d.id]));

  // Los documentos se emparejan por título. Si se le cambia el título a uno del
  // archivo, aquí se crea otro y el viejo se queda en la base respondiendo con
  // el texto antiguo, sin que nada lo delate. Conviene avisar.
  const titulos = new Set(docs.map((d) => d.title));
  const huerfanos = existentes.filter((d) => !titulos.has(d.title));
  if (huerfanos.length) {
    console.log(`\n⚠ ${huerfanos.length} documento(s) en la base que ya no están en el archivo:`);
    huerfanos.forEach((d) => console.log(`   ${d.title}`));
    console.log('   Si les has cambiado el título, bórralos desde el panel: el bot los sigue usando.');
  }

  console.log('');
  for (const d of docs) {
    let id = porTitulo.get(d.title);

    if (id) {
      await supabase(`knowledge_documents?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...d, updated_at: new Date().toISOString() }),
      });
      // Los trozos se regeneran enteros: es más simple que averiguar qué cambió.
      await supabase(`knowledge_chunks?document_id=eq.${id}`, { method: 'DELETE' });
    } else {
      const [creado] = await supabase('knowledge_documents', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ client_id: cliente.id, ...d }),
      });
      id = creado.id;
    }

    const trozos = trocear(d.title, d.content);
    const vectores = await embeddings(trozos);

    await supabase('knowledge_chunks', {
      method: 'POST',
      body: JSON.stringify(
        trozos.map((content, i) => ({
          client_id: cliente.id,
          document_id: id,
          content,
          embedding: vectores[i],
        }))
      ),
    });

    console.log(`  ${porTitulo.has(d.title) ? 'actualizado' : 'creado    '}  ${trozos.length} trozo(s)  ${d.title}`);
  }

  console.log('\nListo. Revísalo en la pestaña Conocimiento del panel.');
}

main().catch((e) => {
  console.error('\nERROR: ' + e.message);
  process.exit(1);
});
