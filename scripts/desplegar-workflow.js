#!/usr/bin/env node
/**
 * Actualiza un workflow que YA existe en n8n y lo publica, sin pasar por el
 * navegador.
 *
 *   node scripts/desplegar-workflow.js n8n/workflows/catalogo-ingesta.json
 *   node scripts/desplegar-workflow.js <archivo.json> "<nombre en n8n>"
 *
 * Importar el JSON desde la interfaz **crea un workflow nuevo** con el mismo
 * nombre, así que no sirve para actualizar: acabas con dos y el webhook lo
 * atiende cualquiera de los dos.
 *
 * Existe además porque pedir un Save+Publish manual falló tres veces: si la
 * pestaña del navegador estaba abierta de antes, al guardar mandaba **su** copia
 * vieja encima de la nueva, y el fallo solo se descubría al ver resultados que
 * no cuadraban.
 *
 * Sin `--aplicar` solo dice lo que haría.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const leerTexto = (ruta) => fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');

// El contenedor de Postgres de n8n y sus credenciales salen de n8n/.env.
const env = {};
for (const l of leerTexto(path.join(RAIZ, 'n8n', '.env')).split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const PG = process.env.N8N_PG_CONTAINER || 'n8n-postgres-1';
const N8N = process.env.N8N_CONTAINER || 'n8n-n8n-1';
const PGU = env.POSTGRES_USER || 'n8n';
const PGD = env.POSTGRES_DB || 'n8n';

const psql = (sql, opciones = {}) =>
  execFileSync(
    'docker',
    ['exec', '-i', PG, 'psql', '-U', PGU, '-d', PGD, '-v', 'ON_ERROR_STOP=1', ...(opciones.args || [])],
    { input: sql, encoding: 'utf8' }
  );

const consultar = (sql) =>
  psql(sql, { args: ['-t', '-A', '-F', '\t'] })
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));

// Postgres no acepta parámetros por stdin, así que los JSON van entre comillas
// de dólar. La etiqueta se comprueba antes: si apareciera dentro del texto, el
// literal se cerraría a la mitad y el SQL haría cualquier cosa.
function dolar(texto) {
  const etiqueta = 'kivuk';
  if (texto.includes(`$${etiqueta}$`)) throw new Error('el JSON contiene la etiqueta de comillas');
  return `$${etiqueta}$${texto}$${etiqueta}$`;
}

function main() {
  const [archivo, nombreArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const aplicar = process.argv.includes('--aplicar');

  if (!archivo) {
    console.error('uso: node scripts/desplegar-workflow.js <archivo.json> ["<nombre en n8n>"] [--aplicar]');
    process.exit(1);
  }

  const wf = JSON.parse(leerTexto(path.resolve(RAIZ, archivo)));
  const nombre = nombreArg || wf.name;

  // «Borrar» en la interfaz de n8n es archivar: el workflow sigue en la tabla
  // con el mismo nombre. Sin filtrar por isArchived, una búsqueda por nombre
  // devuelve dos ids y se acabaría desplegando sobre el archivado.
  const filas = consultar(
    `select id, active, "versionCounter", coalesce("activeVersionId",'') from workflow_entity ` +
      `where name = ${dolar(nombre)} and "isArchived" = false;`
  );

  if (filas.length === 0) throw new Error(`no hay ningún workflow activo llamado "${nombre}" en n8n`);
  if (filas.length > 1) throw new Error(`hay ${filas.length} workflows sin archivar llamados "${nombre}"`);

  const [id, activo, contador] = filas[0];

  // Un nodo webhook sin webhookId activa bien y registra la ruta, pero al
  // llegar la primera petición responde "Cannot read properties of undefined
  // (reading 'node')". Al importar desde la interfaz n8n lo inventa, así que el
  // fallo solo aparece desplegando el JSON directamente.
  const webhooks = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook');
  const sinId = webhooks.filter((n) => !n.webhookId);

  if (sinId.length) {
    const actuales = JSON.parse(
      consultar(`select nodes from workflow_entity where id = ${dolar(id)};`)[0][0]
    );
    for (const n of sinId) {
      // Se reutiliza el que ya tenía ese nodo en n8n; si es nuevo, uno nuevo.
      const previo = actuales.find((x) => x.name === n.name && x.webhookId);
      n.webhookId = previo ? previo.webhookId : crypto.randomUUID();
      console.log(`  webhookId ${previo ? 'recuperado de n8n' : 'generado'} para "${n.name}": ${n.webhookId}`);
    }
  }

  console.log(`\nworkflow:  ${nombre}`);
  console.log(`id:        ${id}   (activo: ${activo}, versión ${contador})`);
  console.log(`nodos:     ${wf.nodes.length}`);
  console.log(`webhooks:  ${webhooks.length}`);

  if (!aplicar) {
    console.log('\nSimulación. Relánzalo con --aplicar para escribir y publicar.');
    return;
  }

  const versionId = crypto.randomUUID();
  const nodes = dolar(JSON.stringify(wf.nodes));
  const connections = dolar(JSON.stringify(wf.connections));
  const settings = dolar(JSON.stringify(wf.settings || { executionOrder: 'v1' }));
  const pinData = dolar(JSON.stringify(wf.pinData || {}));

  // El historial va primero: workflow_entity.activeVersionId tiene una clave
  // ajena contra él, así que apuntar a una versión que aún no existe falla.
  psql(`
begin;

insert into workflow_history ("versionId", "workflowId", authors, nodes, connections, name, autosaved)
values (${dolar(versionId)}, ${dolar(id)}, 'desplegar-workflow.js', ${nodes}, ${connections}, ${dolar(nombre)}, false);

update workflow_entity set
  nodes = ${nodes},
  connections = ${connections},
  settings = ${settings},
  "pinData" = ${pinData},
  "versionId" = ${dolar(versionId)},
  "activeVersionId" = ${dolar(versionId)},
  "versionCounter" = "versionCounter" + 1,
  "updatedAt" = now()
where id = ${dolar(id)};

commit;
`);

  console.log(`\npublicado como versión ${versionId}`);

  // n8n registra los webhooks de las versiones publicadas al arrancar: sin
  // reiniciar, sigue sirviendo la versión anterior.
  console.log('reiniciando n8n...');
  execFileSync('docker', ['restart', N8N], { stdio: 'ignore' });

  console.log('\nListo. Dale unos segundos: /healthz responde antes de que los');
  console.log('webhooks estén registrados, así que una llamada inmediata puede');
  console.log('devolver "Cannot POST /webhook/..." y parecer que se ha roto.');
  console.log('');
  console.log('Si acabas de cambiar n8n/.env o docker-compose.yml, esto NO basta:');
  console.log('`docker restart` reutiliza el contenedor con las variables que ya');
  console.log('tenía. Hay que recrearlo con `docker compose up -d n8n` desde n8n/,');
  console.log('y hacerlo ANTES de desplegar: encadenar los dos reinicios deja a n8n');
  console.log('a medias y arranca con "Last session crashed".');
}

try {
  main();
} catch (e) {
  console.error('\nERROR: ' + (e.stderr || e.message));
  process.exit(1);
}
