#!/usr/bin/env node
/**
 * Enciende la línea propia de una demo: registra el número en la Cloud API y
 * lo deja puesto en su cliente. Es el último paso después de añadir el número
 * a mano en el WhatsApp Manager y confirmar el SMS.
 *
 *   node scripts/activar-numero-demo.js "Peluqueria Mechas" <phone_number_id> <pin>            # solo mira
 *   node scripts/activar-numero-demo.js "Peluqueria Mechas" <phone_number_id> <pin> --aplicar  # lo hace
 *
 * Las líneas de las demos van todas en la WABA de Agencia Kivuk, así que el
 * token y la WABA se copian de la ficha de Kivuk Agencia. No se usa
 * `registrar-numero-whatsapp.js` porque ese coge el primer token que encuentra,
 * y el de Cestería es de otro usuario del sistema: registraría con la llave
 * equivocada.
 *
 * El PIN son 6 dígitos que eliges tú (la verificación en dos pasos del número).
 * Apúntalo: hace falta si algún día hay que volver a registrarlo.
 */
const { clienteSupabase, normalizar } = require('./lib/montar-demo');

const GRAPH = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v25.0'}`;
const WABA_KIVUK = '1786850185674194';

async function meta(ruta, token, cuerpo) {
  const r = await fetch(`${GRAPH}${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok && !json.error, json, error: json.error || {} };
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const [nombre, numeroId, pin] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

  if (!nombre || !numeroId || !pin) {
    throw new Error('Uso: node scripts/activar-numero-demo.js "<cliente>" <phone_number_id> <pin> [--aplicar]');
  }
  if (!/^\d{6}$/.test(pin)) throw new Error('el PIN son exactamente 6 dígitos');

  const supabase = clienteSupabase();
  const clientes = await supabase('clients?select=id,name');
  const nombreDe = new Map(clientes.map((c) => [c.id, c.name]));
  const destino = clientes.find((c) => normalizar(c.name) === normalizar(nombre));
  if (!destino) throw new Error(`no hay ningún cliente que se llame "${nombre}"`);

  const modulos = await supabase('client_modules?module=eq.whatsapp&select=client_id,active,config');
  const kivuk = modulos.find((m) => m.config?.whatsapp_business_account_id === WABA_KIVUK && m.config?.access_token);
  if (!kivuk) throw new Error('no encuentro la ficha de Kivuk Agencia con su token');
  const token = kivuk.config.access_token;

  // Que el número esté de verdad en la WABA de Kivuk: si se añadió en otra, el
  // token no llegaría a él y el fallo saldría más tarde y peor explicado.
  const enWaba = await meta(`/${WABA_KIVUK}/phone_numbers?fields=id,display_phone_number,verified_name,status,name_status`, token);
  if (!enWaba.ok) throw new Error(`Meta: ${enWaba.error.message}`);
  const numero = (enWaba.json.data || []).find((n) => n.id === numeroId);
  if (!numero) {
    const hay = (enWaba.json.data || []).map((n) => `${n.id} (${n.display_phone_number})`).join(', ');
    throw new Error(`el ${numeroId} no está en la WABA de Kivuk. Están: ${hay}`);
  }

  console.log(`Cliente   ${destino.name}`);
  console.log(`Número    ${numero.display_phone_number}  ·  ${numero.verified_name}  ·  status ${numero.status}`);

  const loTiene = modulos.filter((m) => String(m.config?.phone_number_id ?? '') === numeroId && m.client_id !== destino.id);
  if (loTiene.length) {
    throw new Error(`ese número ya está en ${loTiene.map((m) => nombreDe.get(m.client_id)).join(', ')}: un número solo puede contestar por un cliente`);
  }

  const modulo = modulos.find((m) => m.client_id === destino.id);
  const anterior = modulo?.config?.phone_number_id;
  if (anterior && anterior !== numeroId) {
    // Normalmente es el de pruebas de Meta. Pisarlo lo dejaría huérfano sin que
    // nadie lo supiera; se aparca antes con pasar-numero-demo.js.
    throw new Error(`${destino.name} tiene ahora el número ${anterior}. Muévelo antes: node scripts/pasar-numero-demo.js "Cliente de Prueba" --numero ${anterior} --aplicar`);
  }

  if (!aplicar) {
    console.log('\nTodo cuadra. Vuelve a lanzarlo con --aplicar para registrarlo y ponerlo en el cliente.');
    return;
  }

  console.log('\n1. Registrando en la Cloud API…');
  const reg = await meta(`/${numeroId}/register`, token, { messaging_product: 'whatsapp', pin });
  if (reg.ok) console.log('   ✓ registrado');
  else if (reg.error.code === 133005 || /already registered/i.test(reg.error.message || '')) {
    console.log(`   • ya estaba registrado (${reg.error.message})`);
  } else {
    throw new Error(`no se pudo registrar: ${reg.error.message}${reg.error.error_user_msg ? ` — ${reg.error.error_user_msg}` : ''}`);
  }

  // La app ya está suscrita a esta WABA por el número de Kivuk; repetirlo no
  // cuesta nada y cubre el día que alguien la quite.
  console.log('2. Suscripción de la app a la WABA…');
  const sub = await meta(`/${WABA_KIVUK}/subscribed_apps`, token, {});
  if (!sub.ok) throw new Error(`no se pudo suscribir: ${sub.error.message}`);
  console.log('   ✓ suscrita');

  console.log(`3. Poniéndolo en ${destino.name}…`);
  await supabase('client_modules?on_conflict=client_id,module', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      client_id: destino.id,
      module: 'whatsapp',
      active: true,
      config: {
        ...(modulo?.config ?? {}),
        phone_number_id: numeroId,
        whatsapp_business_account_id: WABA_KIVUK,
        access_token: token,
      },
    }),
  });
  console.log('   ✓ guardado');

  const estado = await meta(`/${numeroId}?fields=display_phone_number,verified_name,status,name_status`, token);
  console.log(`\nEstado en Meta: ${JSON.stringify(estado.json)}`);
  console.log(estado.json.status === 'CONNECTED'
    ? `\nListo. Escribe al ${numero.display_phone_number} desde tu móvil y debería contestar ${destino.name}.`
    : `\nOjo: status ${estado.json.status}. Espera un minuto y vuelve a lanzarlo (sin riesgo: es idempotente).`);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
