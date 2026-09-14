#!/usr/bin/env node
/**
 * Las plantillas de WhatsApp de un cliente: verlas y darlas de alta.
 *
 *   node scripts/plantilla-whatsapp.js "Peluqueria Mechas"                # las que tiene
 *   node scripts/plantilla-whatsapp.js "Peluqueria Mechas" --crear        # simula el alta
 *   node scripts/plantilla-whatsapp.js "Peluqueria Mechas" --crear --aplicar
 *
 * Por qué existe y no se hace desde el panel de Meta: la plantilla y el código
 * que la rellena son **una sola cosa**. El cuerpo tiene cuatro huecos y el
 * workflow manda cuatro valores en un orden concreto; si alguien edita el texto
 * en WhatsApp Manager y mueve un hueco, el recordatorio sale con la hora en el
 * sitio del día y nadie se entera hasta que lo lee un cliente. Teniéndola aquí,
 * el texto que se envía a revisión está versionado en git al lado del workflow
 * que lo usa.
 *
 * Una plantilla aprobada NO se puede editar en su idioma: se crea otra. Por eso
 * el alta pide confirmación con `--aplicar`, como los demás scripts del repo.
 *
 * Meta tarda entre unos minutos y 24 horas en revisar. Hasta que el estado sea
 * APPROVED, enviarla devuelve error y el recordatorio no sale.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const leerTexto = (ruta) => fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');

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

const VERSION_API = process.env.META_API_VERSION || 'v25.0';

// ---------------------------------------------------------------------------
// La plantilla del recordatorio de cita.
//
// Decisiones que parecen menores y no lo son:
//
// - **UTILITY, no MARKETING.** Un recordatorio de algo que la persona pidió es
//   una utilidad. Como marketing costaría más, necesitaría opt-in explícito y
//   Meta la rechazaría por no vender nada.
//
// - **Sin el nombre de quien viene.** Un parámetro vacío hace que Meta rechace
//   el envío entero, y el nombre falta más de lo que parece: una cita dada a
//   mano en el mostrador puede no tener nombre. «Hola {{1}}» con el hueco vacío
//   no es que quede mal, es que no sale.
//
// - **Cada hueco lleva su etiqueta delante** («Día:», «Hora:», «Con:»). Dos
//   parámetros seguidos, aunque estén en líneas distintas, son motivo de
//   rechazo. Además se lee mejor.
//
// - **Termina invitando a contestar.** Esa respuesta abre la ventana de 24
//   horas y a partir de ahí el bot puede cambiar o anular la cita hablando
//   normal, sin más plantillas.
const RECORDATORIO = {
  name: 'recordatorio_cita',
  language: 'es',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Recordatorio de tu cita',
    },
    {
      type: 'BODY',
      text:
        'Te recordamos tu cita en {{1}}.\n\n' +
        'Día: {{2}}\n' +
        'Hora: {{3}}\n' +
        'Con: {{4}}\n\n' +
        'Si no puedes venir o quieres cambiarla, contéstanos a este mensaje y lo vemos.',
      example: {
        body_text: [['Peluquería Mechas', 'martes 15 de septiembre', '10:00', 'Ana']],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const nombreCliente = args.filter((a) => !a.startsWith('--'))[0];
  const crear = args.includes('--crear');
  const aplicar = args.includes('--aplicar');

  if (!nombreCliente) {
    console.error('uso: node scripts/plantilla-whatsapp.js "<nombre del cliente>" [--crear] [--aplicar]');
    process.exit(1);
  }

  const env = cargarEnv();
  const URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

  const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

  const clientes = await (
    await fetch(`${URL}/rest/v1/clients?select=id,name`, { headers: cab })
  ).json();

  const cliente = clientes.find(
    (c) => c.name.toLowerCase().includes(nombreCliente.toLowerCase())
  );
  if (!cliente) {
    throw new Error(
      `no hay ningún cliente que se parezca a "${nombreCliente}". Hay: ` +
        clientes.map((c) => c.name).join(', ')
    );
  }

  const mods = await (
    await fetch(
      `${URL}/rest/v1/client_modules?select=config&client_id=eq.${cliente.id}&module=eq.whatsapp`,
      { headers: cab }
    )
  ).json();

  const config = (mods[0] && mods[0].config) || {};
  const waba = config.whatsapp_business_account_id;
  const token = config.access_token;

  if (!waba || !token) {
    throw new Error(
      `${cliente.name} no tiene credenciales de WhatsApp completas ` +
        '(hacen falta whatsapp_business_account_id y access_token en el panel)'
    );
  }

  console.log(`\ncliente: ${cliente.name}`);
  console.log(`WABA:    ${waba}\n`);

  // --- lo que ya tiene -----------------------------------------------------
  const lista = await (
    await fetch(
      `https://graph.facebook.com/${VERSION_API}/${waba}/message_templates?limit=50`,
      { headers: { Authorization: 'Bearer ' + token } }
    )
  ).json();

  if (lista.error) throw new Error('Meta: ' + lista.error.message);

  if (!lista.data || !lista.data.length) {
    console.log('No hay ninguna plantilla dada de alta.');
  } else {
    console.log('Plantillas:');
    for (const p of lista.data) {
      console.log(`  ${p.status.padEnd(10)} ${p.category.padEnd(9)} ${p.name} (${p.language})`);
    }
  }

  if (!crear) {
    console.log('\nRelánzalo con --crear para dar de alta el recordatorio de citas.');
    return;
  }

  // --- el alta -------------------------------------------------------------
  const yaEsta = (lista.data || []).find(
    (p) => p.name === RECORDATORIO.name && p.language === RECORDATORIO.language
  );
  if (yaEsta) {
    console.log(
      `\n"${RECORDATORIO.name}" ya existe en ${RECORDATORIO.language} y está en ${yaEsta.status}.`
    );
    console.log('Una plantilla no se edita: si hay que cambiar el texto, se borra y se crea otra.');
    return;
  }

  console.log('\nSe va a enviar a revisión de Meta:\n');
  console.log('  nombre:   ' + RECORDATORIO.name);
  console.log('  idioma:   ' + RECORDATORIO.language);
  console.log('  categoría:' + RECORDATORIO.category);
  for (const c of RECORDATORIO.components) {
    console.log('\n  [' + c.type + ']');
    console.log(c.text.split('\n').map((l) => '  | ' + l).join('\n'));
  }

  if (!aplicar) {
    console.log('\nSimulación. Relánzalo con --aplicar para mandarla a revisión.');
    return;
  }

  const r = await fetch(
    `https://graph.facebook.com/${VERSION_API}/${waba}/message_templates`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(RECORDATORIO),
    }
  );
  const res = await r.json();

  if (res.error) {
    console.error('\nMeta la ha rechazado: ' + res.error.message);
    if (res.error.error_user_msg) console.error('  ' + res.error.error_user_msg);
    process.exit(1);
  }

  console.log(`\nEnviada. id ${res.id}, estado ${res.status || 'PENDING'}.`);
  console.log('Vuelve a lanzar el script sin --crear dentro de un rato para ver si ya está APPROVED.');
}

main().catch((e) => {
  console.error('\nERROR: ' + e.message);
  process.exit(1);
});
