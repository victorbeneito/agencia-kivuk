#!/usr/bin/env node
/**
 * Sube la cartera de inmuebles de un cliente desde un CSV a la tabla `inmuebles`
 * (migración 0025).
 *
 *   node scripts/cargar-inmuebles.js docs/inmuebles-inmobiliaria-llaves.csv "Inmobiliaria Llaves"
 *   node scripts/cargar-inmuebles.js docs/inmuebles-inmobiliaria-llaves.csv "Inmobiliaria Llaves" --aplicar
 *
 * Sin `--aplicar` no escribe: valida el CSV y cuenta qué entraría, qué cambiaría
 * y qué se retiraría.
 *
 * Empareja por referencia, así que es idempotente y sirve también para devolver
 * una demo a su estado de fábrica. Lo que está en la base y ya no está en el CSV
 * no se borra: pasa a `retirado`, que es lo que es un piso vendido. Borrarlo
 * dejaría a medias cualquier conversación que lo nombre.
 *
 * Las columnas, en `docs/demo-inmobiliaria-llaves.md`.
 */
const fs = require('fs');
const path = require('path');
const { clienteSupabase } = require('./lib/montar-demo');

const RAIZ = path.resolve(__dirname, '..');

const COLUMNAS = [
  'ref', 'operacion', 'tipo', 'municipio', 'zona', 'precio', 'habitaciones',
  'banos', 'm2', 'm2_parcela', 'estado', 'situacion', 'extras', 'descripcion',
];

/**
 * El CSV es nuestro, así que se parte por comas sin más, como el de servicios
 * de `montar-demo.js`; la descripción no lleva comas por eso mismo. Lo que sí
 * se comprueba es que cada fila tenga sus 14 columnas: una coma de más en una
 * descripción desplaza todo lo que va detrás, y el precio acabaría en las
 * habitaciones sin que nada fallara.
 */
function leerCartera(texto) {
  const lineas = texto.replace(/\r\n/g, '\n').trim().split('\n');
  const cabecera = lineas[0].split(',').map((c) => c.trim());
  if (cabecera.join(',') !== COLUMNAS.join(',')) {
    throw new Error(`la cabecera no es la esperada:\n  ${cabecera.join(',')}\n  ${COLUMNAS.join(',')}`);
  }

  const errores = [];
  const entero = (v) => (v === '' ? null : Number(v));

  const filas = lineas.slice(1).map((linea, i) => {
    const n = i + 2;
    const c = linea.split(',').map((x) => x.trim());
    if (c.length !== COLUMNAS.length) {
      errores.push(`línea ${n}: ${c.length} columnas en vez de ${COLUMNAS.length}`);
      return null;
    }
    const f = Object.fromEntries(COLUMNAS.map((k, j) => [k, c[j]]));

    const fila = {
      ref: f.ref,
      operacion: f.operacion,
      tipo: f.tipo,
      municipio: f.municipio,
      zona: f.zona || null,
      precio: f.precio === '' ? null : Number(f.precio),
      habitaciones: entero(f.habitaciones),
      banos: entero(f.banos),
      m2: entero(f.m2),
      m2_parcela: entero(f.m2_parcela),
      estado: f.estado || null,
      situacion: f.situacion || 'disponible',
      extras: f.extras ? f.extras.split('|').map((x) => x.trim()).filter(Boolean) : [],
      descripcion: f.descripcion || null,
    };

    if (!fila.ref) errores.push(`línea ${n}: sin referencia`);
    if (!['venta', 'alquiler'].includes(fila.operacion)) errores.push(`línea ${n}: operación «${f.operacion}»`);
    if (!['disponible', 'reservado', 'retirado'].includes(fila.situacion)) errores.push(`línea ${n}: situación «${f.situacion}»`);
    if (!fila.tipo || !fila.municipio) errores.push(`línea ${n}: falta el tipo o el municipio`);
    for (const k of ['precio', 'habitaciones', 'banos', 'm2', 'm2_parcela']) {
      if (fila[k] !== null && !(Number.isFinite(fila[k]) && fila[k] >= 0)) errores.push(`línea ${n}: ${k} «${f[k]}» no es un número`);
    }
    // Un alquiler de 150.000 o una venta de 700 es una columna cambiada, no un
    // precio: el bot lo enseñaría tal cual.
    if (fila.operacion === 'alquiler' && fila.precio > 20000) errores.push(`línea ${n}: alquiler de ${fila.precio} €/mes`);
    if (fila.operacion === 'venta' && fila.precio !== null && fila.precio < 5000) errores.push(`línea ${n}: venta por ${fila.precio} €`);
    return fila;
  });

  const refs = filas.filter(Boolean).map((f) => f.ref);
  const repetidas = refs.filter((r, i) => refs.indexOf(r) !== i);
  if (repetidas.length) errores.push(`referencias repetidas: ${[...new Set(repetidas)].join(', ')}`);

  if (errores.length) throw new Error(`el CSV tiene errores:\n  ${errores.join('\n  ')}`);
  return filas;
}

async function principal() {
  const [ruta, nombreCliente, ...resto] = process.argv.slice(2);
  const aplicar = resto.includes('--aplicar');

  if (!ruta || !nombreCliente) {
    console.error('Uso: node scripts/cargar-inmuebles.js <fichero.csv> "<nombre del cliente>" [--aplicar]');
    process.exit(1);
  }

  const filas = leerCartera(fs.readFileSync(path.isAbsolute(ruta) ? ruta : path.join(RAIZ, ruta), 'utf8'));
  const cuenta = (pred) => filas.filter(pred).length;
  console.log(`Cartera: ${filas.length} inmuebles en ${ruta}`);
  console.log(`  venta ${cuenta((f) => f.operacion === 'venta')}, alquiler ${cuenta((f) => f.operacion === 'alquiler')}, reservados ${cuenta((f) => f.situacion === 'reservado')}`);

  const supabase = clienteSupabase();
  const clientes = await supabase(`clients?name=ilike.${encodeURIComponent(nombreCliente)}&select=id,name`);
  if (!clientes.length) throw new Error(`no hay ningún cliente que se llame «${nombreCliente}» (móntalo antes)`);
  const cliente = clientes[0];
  console.log(`Cliente: ${cliente.name} (${cliente.id})`);

  const previos = await supabase(`inmuebles?client_id=eq.${cliente.id}&select=id,ref,situacion`);
  const enCsv = new Set(filas.map((f) => f.ref));
  const aRetirar = previos.filter((p) => !enCsv.has(p.ref) && p.situacion !== 'retirado');
  const nuevos = filas.filter((f) => !previos.some((p) => p.ref === f.ref));

  console.log(`\n  ${nuevos.length} nuevos, ${filas.length - nuevos.length} se actualizan, ${aRetirar.length} se retiran`);

  if (!aplicar) {
    console.log('\nSimulacro: no se ha escrito nada. Añade --aplicar para subirlo.');
    return;
  }

  const ahora = new Date().toISOString();
  await supabase('inmuebles?on_conflict=client_id,ref', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(filas.map((f) => ({ ...f, client_id: cliente.id, updated_at: ahora }))),
  });

  for (const p of aRetirar) {
    await supabase(`inmuebles?id=eq.${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ situacion: 'retirado', updated_at: ahora }),
    });
  }

  // Leer de vuelta en vez de fiarse del 200: es la costumbre del proyecto.
  const cartera = await supabase('rpc/inmuebles_cartera', {
    method: 'POST',
    body: JSON.stringify({ p_client_id: cliente.id }),
  });
  console.log(`\n✓ Subido. Lo que verá el bot: ${cartera.total} disponibles, ${cartera.tipos.length} tipos, ${cartera.municipios.length} municipios.`);
}

if (require.main === module) {
  principal().catch((e) => {
    console.error(`\n✖ ${e.message}`);
    process.exit(1);
  });
}

module.exports = { leerCartera };
