#!/usr/bin/env node
/**
 * Carga los sinónimos del catálogo de un cliente en su configuración
 * (client_modules.config.catalog_sinonimos, módulo social, el del catálogo).
 *
 *   node scripts/cargar-sinonimos.js docs/sinonimos-catalogo-cesteria.json "Cesteria Aparici"
 *   node scripts/cargar-sinonimos.js <archivo.json> <cliente> --aplicar
 *
 * El bot los usa al buscar productos (nodo «Preparar búsqueda»): la búsqueda
 * compara letras, y «leña» no está dentro de «leñero» ni «roba» dentro de nada.
 * Son datos de cada tienda, así que viven en un JSON versionado del repo y no en
 * el código del workflow.
 *
 * Solo toca esa clave: el resto del config (sitemap, tokens de Meta…) se lee y se
 * vuelve a escribir tal cual. Las claves del JSON que empiezan por «_» son notas
 * y no se cargan. Sin --aplicar, solo enseña lo que haría.
 */
const fs = require('fs');
const path = require('path');
const { clienteSupabase } = require('./lib/montar-demo');

(async () => {
  const [archivo, nombreCliente] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const aplicar = process.argv.includes('--aplicar');
  if (!archivo || !nombreCliente) {
    console.error('Uso: node scripts/cargar-sinonimos.js <archivo.json> "<cliente>" [--aplicar]');
    process.exit(1);
  }

  const crudo = JSON.parse(fs.readFileSync(path.resolve(archivo), 'utf8'));
  const sinonimos = Object.fromEntries(
    Object.entries(crudo).filter(([k]) => !k.startsWith('_'))
  );
  for (const [k, v] of Object.entries(sinonimos)) {
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.trim())) {
      throw new Error(`«${k}»: el valor tiene que ser una lista de palabras`);
    }
  }

  const sb = clienteSupabase();
  const clientes = await sb(`clients?name=eq.${encodeURIComponent(nombreCliente)}&select=id,name`);
  if (clientes.length !== 1) throw new Error(`no encuentro un único cliente llamado «${nombreCliente}»`);
  const clientId = clientes[0].id;

  const filas = await sb(`client_modules?client_id=eq.${clientId}&module=eq.social&select=config`);
  if (filas.length !== 1) throw new Error('el cliente no tiene el módulo social (el del catálogo)');
  const config = filas[0].config || {};

  // Postgres guarda el jsonb con las claves en otro orden: se compara ordenando.
  const igual = (a, b) => {
    const norm = (v) => (v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().map((k) => [k, norm(v[k])])
      : v);
    return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
  };

  const antes = config.catalog_sinonimos || {};
  console.log(`Cliente: ${clientes[0].name} (${clientId})`);
  console.log(`Sinónimos: ${Object.keys(sinonimos).length} palabras (antes: ${Object.keys(antes).length})`);
  if (igual(antes, sinonimos)) {
    console.log('Ya están cargados exactamente estos. No hay nada que hacer.');
    return;
  }
  if (!aplicar) {
    console.log('\nSimulacro: no se ha escrito nada. Añade --aplicar para cargarlos.');
    return;
  }

  await sb(`client_modules?client_id=eq.${clientId}&module=eq.social`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ config: { ...config, catalog_sinonimos: sinonimos } }),
  });
  const despues = (await sb(`client_modules?client_id=eq.${clientId}&module=eq.social&select=config`))[0].config;
  const bien = igual(despues.catalog_sinonimos, sinonimos) &&
    Object.keys(config).every((k) => k === 'catalog_sinonimos' || igual(config[k], despues[k]));
  console.log(bien ? '✓ Cargados y comprobados; el resto del config sigue igual.' : '✗ Algo no cuadra: revisa el config del módulo social.');
  if (!bien) process.exit(1);
})().catch((e) => { console.error(e.message); process.exit(1); });
