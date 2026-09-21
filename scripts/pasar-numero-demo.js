#!/usr/bin/env node
/**
 * Pasa un número de WhatsApp de un cliente a otro. Pensado para las demos:
 * hay un solo número de pruebas de Meta y varias demos (Peluquería Mechas,
 * Clínica Dental Muelas), y en cada reunión se enseña una.
 *
 *   node scripts/pasar-numero-demo.js "Clinica Dental Muelas"            # simulación
 *   node scripts/pasar-numero-demo.js "Clinica Dental Muelas" --aplicar  # lo mueve
 *   node scripts/pasar-numero-demo.js "Peluqueria Mechas" --numero 123456789 --aplicar
 *
 * Sin `--numero` mueve el de pruebas de Meta (+1 555-153-9782).
 *
 * El bot resuelve el cliente por `phone_number_id`, así que un número solo
 * puede estar en un cliente a la vez: si estuviera en dos, contestaría el que
 * saliera primero en la consulta, y parecería que el bot "se equivoca de
 * negocio". Por eso se limpia el origen ANTES de escribir el destino, y si el
 * destino falla se devuelve al origen.
 *
 * Se mueven las tres credenciales juntas (número, WABA y token): el token es
 * el de la WABA del número, y dejarlo atrás sería dejar el número mudo.
 */
const { clienteSupabase, normalizar } = require('./lib/montar-demo');

const NUMERO_PRUEBAS_META = '1120415504498664';
const CREDENCIALES = ['phone_number_id', 'whatsapp_business_account_id', 'access_token'];

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : process.argv[i + 1];
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const numero = argumento('--numero') || NUMERO_PRUEBAS_META;
  const destinoNombre = process.argv.slice(2).find((a, i, todos) => !a.startsWith('--') && todos[i - 1] !== '--numero');

  if (!destinoNombre) {
    throw new Error('Uso: node scripts/pasar-numero-demo.js "<cliente destino>" [--numero <phone_number_id>] [--aplicar]');
  }

  const supabase = clienteSupabase();

  const clientes = await supabase('clients?select=id,name');
  const nombreDe = new Map(clientes.map((c) => [c.id, c.name]));
  const destino = clientes.find((c) => normalizar(c.name) === normalizar(destinoNombre));
  if (!destino) throw new Error(`no hay ningún cliente que se llame "${destinoNombre}"`);

  const modulos = await supabase('client_modules?module=eq.whatsapp&select=client_id,active,config');
  const tienen = modulos.filter((m) => String(m.config?.phone_number_id ?? '') === numero);

  console.log(`Número   ${numero}${numero === NUMERO_PRUEBAS_META ? ' (el de pruebas de Meta)' : ''}`);
  console.log(`Destino  ${destino.name}`);

  if (!tienen.length) {
    throw new Error('ese número no está en ningún cliente: hay que ponerlo a mano desde el panel la primera vez');
  }
  if (tienen.length > 1) {
    // Es justo el estado que este script existe para evitar; no se arregla a
    // ciegas porque no sabemos cuál de los dos tiene el token bueno.
    throw new Error(`ese número está en ${tienen.length} clientes a la vez (${tienen.map((m) => nombreDe.get(m.client_id)).join(', ')}): déjalo en uno desde el panel`);
  }

  const origen = tienen[0];
  console.log(`Origen   ${nombreDe.get(origen.client_id)}`);

  if (origen.client_id === destino.id) {
    console.log('\nYa está en ese cliente. Nada que hacer.');
    return;
  }

  const moduloDestino = modulos.find((m) => m.client_id === destino.id);
  if (moduloDestino?.config?.phone_number_id) {
    // Si el destino tiene su propio número, pisarlo lo dejaría sin línea y
    // nadie se enteraría hasta que un cliente de verdad escribiera.
    throw new Error(`${destino.name} ya tiene otro número (${moduloDestino.config.phone_number_id}); quítaselo antes desde el panel`);
  }

  if (!aplicar) {
    console.log('\nEsto es una simulación. Vuelve a lanzarlo con --aplicar para moverlo.');
    return;
  }

  const credenciales = Object.fromEntries(CREDENCIALES.map((k) => [k, origen.config[k] ?? '']));
  const vacias = Object.fromEntries(CREDENCIALES.map((k) => [k, '']));

  const escribir = (clientId, config, active) =>
    supabase('client_modules?on_conflict=client_id,module', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ client_id: clientId, module: 'whatsapp', active, config }),
    });

  await escribir(origen.client_id, { ...origen.config, ...vacias }, origen.active);
  console.log(`\n✓ quitado de ${nombreDe.get(origen.client_id)}`);

  try {
    await escribir(destino.id, { ...(moduloDestino?.config ?? {}), ...credenciales }, true);
  } catch (e) {
    await escribir(origen.client_id, origen.config, origen.active);
    throw new Error(`no se pudo escribir en ${destino.name}; se ha devuelto a ${nombreDe.get(origen.client_id)}. ${e.message}`);
  }
  console.log(`✓ puesto en ${destino.name}`);

  console.log(`\nA partir de ahora ese número contesta como ${destino.name}.`);
  console.log(`Los recordatorios de las citas que queden en ${nombreDe.get(origen.client_id)} no saldrán mientras no tenga número.`);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
