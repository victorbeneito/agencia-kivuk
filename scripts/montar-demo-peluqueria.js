#!/usr/bin/env node
/**
 * Monta (o repone) el cliente de demostración «Peluquería Mechas».
 *
 * Hace lo mismo que haría alguien pinchando en el panel, pero de una vez: el
 * alta del cliente, sus dos módulos, el horario del negocio, las tres
 * trabajadoras con su horario día a día, los 25 servicios del CSV y la matriz
 * de quién hace qué. A mano son unos doscientos clics, y la parte que más se
 * equivoca —las tardes libres de cada una— es justo la que no se ve luego.
 *
 *   node scripts/montar-demo-peluqueria.js            # simulación
 *   node scripts/montar-demo-peluqueria.js --aplicar  # lo escribe
 *
 * Es idempotente: se puede relanzar las veces que haga falta. Empareja por
 * nombre (cliente, trabajadora, servicio) y actualiza en vez de duplicar, así
 * que también sirve para devolver la demo a su estado de fábrica después de
 * haberla enseñado.
 *
 * Lo que NO toca: las credenciales de WhatsApp y de Google, el prompt y el
 * conocimiento. El prompt y el conocimiento tienen sus propios cargadores:
 *
 *   node scripts/cargar-prompt.js docs/prompt-peluqueria-mechas.md "Peluqueria Mechas"
 *   node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "Peluqueria Mechas" --aplicar
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const leerTexto = (ruta) => fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');

// --- configuración -------------------------------------------------------
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

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })) {
  if (!v) throw new Error(`falta ${k} en app/.env.local`);
}

// --- lo que se monta -----------------------------------------------------

const CLIENTE = 'Peluqueria Mechas';
const CSV_SERVICIOS = 'docs/servicios-peluqueria-mechas.csv';

/**
 * Horario del negocio. Vive en `client_modules.config` del módulo calendar y es
 * de donde hereda su horario cada trabajadora nueva (`crearTrabajador`), además
 * de dar la duración por defecto mientras el bot no mande el servicio.
 */
const MODULO_CALENDAR = {
  dias_laborables: '2,3,4,5,6', // martes a sábado
  manana_inicio: '10:00',
  manana_fin: '14:00',
  tarde_inicio: '16:00',
  tarde_fin: '20:00',
  duracion_min: '60',
  paso_min: '15',
};

const MAÑANA = ['10:00', '14:00'];
const TARDE = ['16:00', '20:00'];

/**
 * Las tres, con su horario día a día (2 = martes ... 6 = sábado).
 *
 * Cada una libra una tarde distinta y ninguna coincide, así que el salón nunca
 * se queda con una sola persona por la tarde. Que la agenda NO sea un
 * rectángulo perfecto es la mitad de la credibilidad de la demo: una peluquera
 * mira los huecos y lo primero que reconoce es que su semana tampoco es plana.
 */
const TRABAJADORAS = [
  { nombre: 'Ana', orden: 0, horario: { 2: [MAÑANA, TARDE], 3: [MAÑANA], 4: [MAÑANA, TARDE], 5: [MAÑANA, TARDE], 6: [MAÑANA] } },
  { nombre: 'Sonia', orden: 1, horario: { 2: [MAÑANA], 3: [MAÑANA, TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA, TARDE], 6: [MAÑANA] } },
  { nombre: 'Luisa', orden: 2, horario: { 2: [MAÑANA, TARDE], 3: [MAÑANA, TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA], 6: [MAÑANA] } },
];

/**
 * Quién hace qué. Lo que no aparece aquí lo hacen las tres (lavados, peinados,
 * cortes de mujer, caballero y niños, hidratación y anticaída).
 *
 * De aquí salen las dos frases que mejor venden esto en una peluquería —«Luisa
 * no hace mechas, te las puede hacer Ana o Sonia» y «las novias las lleva
 * Ana»—, así que no es relleno: es el guion.
 */
const SOLO_LAS_HACEN = {
  'Arreglo de barba': ['Luisa'],
  'Retoque de raíz': ['Ana', 'Sonia'],
  'Color completo': ['Ana', 'Sonia'],
  'Matiz': ['Ana', 'Sonia'],
  'Baño de color': ['Ana', 'Sonia'],
  'Mechas medio casco': ['Ana', 'Sonia'],
  'Mechas casco completo': ['Ana', 'Sonia'],
  'Balayage': ['Ana', 'Sonia'],
  'Decoloración': ['Ana', 'Sonia'],
  'Alisado de keratina': ['Ana', 'Sonia'],
  'Botox capilar': ['Ana', 'Sonia'],
  'Permanente': ['Ana', 'Sonia'],
  'Peinado de fiesta': ['Ana', 'Luisa'],
  'Recogido': ['Ana', 'Luisa'],
  'Novia - prueba': ['Ana'],
  'Novia - dia de la boda': ['Ana'],
};

// --- utilidades ----------------------------------------------------------

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

const crear = (tabla, filas) =>
  supabase(tabla, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(filas),
  });

/** Mismo criterio que el panel: sin tildes, sin mayúsculas y sin dobles espacios. */
const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * El CSV es nuestro y sale de este mismo repositorio, así que se parte por
 * comas sin más: la detección de separador y las comillas del importador del
 * panel (`lib/agenda-csv.ts`) están para los ficheros que llegan de un Excel
 * ajeno, no para este.
 */
function leerServicios() {
  const lineas = leerTexto(path.join(RAIZ, CSV_SERVICIOS)).trim().split('\n');
  return lineas.slice(1).map((linea, i) => {
    const campos = linea.split(',').map((c) => c.trim());
    return {
      nombre: campos[0],
      duracion_min: Number(campos[1]),
      alias: campos.slice(2).filter(Boolean),
      orden: i,
    };
  });
}

// --- programa ------------------------------------------------------------

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const servicios = leerServicios();

  console.log(`Cliente de demostración: ${CLIENTE}\n`);
  console.log(`  módulos      whatsapp (sin credenciales todavía), calendar`);
  console.log(`  horario      martes a sábado, ${MODULO_CALENDAR.manana_inicio}-${MODULO_CALENDAR.manana_fin} y ${MODULO_CALENDAR.tarde_inicio}-${MODULO_CALENDAR.tarde_fin}`);
  console.log(`  trabajadoras ${TRABAJADORAS.map((t) => t.nombre).join(', ')}`);
  console.log(`  servicios    ${servicios.length} desde ${CSV_SERVICIOS}`);

  const malos = servicios.filter((s) => !s.nombre || !Number.isInteger(s.duracion_min) || s.duracion_min <= 0);
  if (malos.length) throw new Error(`el CSV tiene ${malos.length} fila(s) sin nombre o sin duración válida`);

  const desconocidos = Object.keys(SOLO_LAS_HACEN).filter(
    (n) => !servicios.some((s) => normalizar(s.nombre) === normalizar(n))
  );
  if (desconocidos.length) {
    // Un servicio de la matriz que no está en el CSV no da error en la base:
    // simplemente no se asigna a nadie, y queda reservable por las tres.
    throw new Error(`la matriz nombra servicios que no están en el CSV: ${desconocidos.join(', ')}`);
  }

  const agencias = await supabase('agencies?select=id,name');
  if (!agencias.length) throw new Error('no hay ninguna agencia en la base');
  if (agencias.length > 1) throw new Error(`hay ${agencias.length} agencias; este script asume una sola`);
  const agencia = agencias[0];
  console.log(`  agencia      ${agencia.name}`);

  const existentes = await supabase(`clients?name=ilike.${encodeURIComponent(CLIENTE)}&select=id,name`);
  console.log(`\n${existentes.length ? `Ya existe (${existentes[0].id}): se actualiza.` : 'No existe todavía: se crea.'}`);

  if (!aplicar) {
    console.log('\nEsto es una simulación. Vuelve a lanzarlo con --aplicar para escribirlo.');
    return;
  }

  // --- cliente -----------------------------------------------------------
  let cliente = existentes[0];
  if (!cliente) {
    cliente = (await crear('clients', { agency_id: agencia.id, name: CLIENTE }))[0];
    console.log(`\n✓ cliente creado (${cliente.id})`);
  }

  const configs = await supabase(`agent_configs?client_id=eq.${cliente.id}&select=id`);
  if (!configs.length) {
    await crear('agent_configs', {
      client_id: cliente.id,
      name: 'Bot principal',
      system_prompt: '',
      knowledge_base: '',
    });
    console.log('✓ configuración de bot creada (el prompt lo carga cargar-prompt.js)');
  }

  // --- módulos -----------------------------------------------------------
  // El de WhatsApp se deja activo y sin config: las credenciales se ponen desde
  // el panel cuando exista el número, y pisarlas aquí sería perderlas.
  const modulos = await supabase(`client_modules?client_id=eq.${cliente.id}&select=module,config`);
  const configCalendar = modulos.find((m) => m.module === 'calendar')?.config ?? {};

  await supabase('client_modules', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([
      { client_id: cliente.id, module: 'whatsapp', active: true, config: modulos.find((m) => m.module === 'whatsapp')?.config ?? {} },
      // Se fusiona sobre lo que hubiera: si algún día se conecta Google, sus
      // credenciales viven en este mismo campo.
      { client_id: cliente.id, module: 'calendar', active: true, config: { ...configCalendar, ...MODULO_CALENDAR } },
    ]),
  });
  console.log('✓ módulos whatsapp y calendar activos, con el horario del negocio');

  // --- trabajadoras ------------------------------------------------------
  const staffPrevio = await supabase(`staff?client_id=eq.${cliente.id}&select=id,nombre`);
  const staffPorNombre = new Map(staffPrevio.map((s) => [normalizar(s.nombre), s]));
  const idPorNombre = new Map();

  for (const t of TRABAJADORAS) {
    let fila = staffPorNombre.get(normalizar(t.nombre));

    if (fila) {
      await supabase(`staff?id=eq.${fila.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: true, orden: t.orden }),
      });
    } else {
      fila = (await crear('staff', {
        client_id: cliente.id,
        nombre: t.nombre,
        calendar_id: null,
        activo: true,
        orden: t.orden,
      }))[0];
    }

    idPorNombre.set(t.nombre, fila.id);

    // Igual que el panel: se valida antes, se borra y se reescribe. Un
    // trabajador sin filas aquí no trabaja nunca.
    const tramos = [];
    for (const [dia, franjas] of Object.entries(t.horario)) {
      for (const [inicio, fin] of franjas) {
        tramos.push({ staff_id: fila.id, dia_semana: Number(dia), hora_inicio: inicio, hora_fin: fin });
      }
    }

    await supabase(`staff_hours?staff_id=eq.${fila.id}`, { method: 'DELETE' });
    await crear('staff_hours', tramos);

    console.log(`✓ ${t.nombre}: ${tramos.length} tramos horarios`);
  }

  const sobran = staffPrevio.filter((s) => !TRABAJADORAS.some((t) => normalizar(t.nombre) === normalizar(s.nombre)));
  if (sobran.length) {
    // No se borran: pueden tener citas, y borrarlas sería perder el historial.
    console.log(`⚠ hay ${sobran.length} trabajador(es) que no son de la demo: ${sobran.map((s) => s.nombre).join(', ')}`);
    console.log('   (la migración 0014 crea un "Principal" a todo cliente con agenda; desactívalo desde el panel)');
  }

  // --- servicios ---------------------------------------------------------
  const serviciosPrevios = await supabase(`booking_services?client_id=eq.${cliente.id}&select=id,nombre`);
  const servicioPorNombre = new Map(serviciosPrevios.map((s) => [normalizar(s.nombre), s]));
  const idServicio = new Map();
  let altas = 0;
  let cambios = 0;

  for (const s of servicios) {
    const previo = servicioPorNombre.get(normalizar(s.nombre));
    const fila = { duracion_min: s.duracion_min, alias: s.alias, activo: true, orden: s.orden };

    if (previo) {
      await supabase(`booking_services?id=eq.${previo.id}`, { method: 'PATCH', body: JSON.stringify(fila) });
      idServicio.set(s.nombre, previo.id);
      cambios++;
    } else {
      const creado = (await crear('booking_services', { client_id: cliente.id, nombre: s.nombre, ...fila }))[0];
      idServicio.set(s.nombre, creado.id);
      altas++;
    }
  }

  console.log(`✓ servicios: ${altas} nuevos, ${cambios} actualizados`);

  // --- matriz ------------------------------------------------------------
  // Se calcula la diferencia en vez de borrar y reescribir: si el borrado
  // saliera bien y el alta fallara, la demo se quedaría con todos los
  // servicios sin nadie que los haga, que es un estado que no se ve hasta que
  // el bot dice "no tengo a nadie" delante de un cliente.
  const deseadas = new Set();
  for (const s of servicios) {
    const quienes = SOLO_LAS_HACEN[s.nombre] ?? TRABAJADORAS.map((t) => t.nombre);
    for (const nombre of quienes) deseadas.add(`${idServicio.get(s.nombre)}|${idPorNombre.get(nombre)}`);
  }

  const matrizPrevia = await supabase(
    `booking_service_staff?client_id=eq.${cliente.id}&select=booking_service_id,staff_id`
  );
  const actuales = new Set(matrizPrevia.map((m) => `${m.booking_service_id}|${m.staff_id}`));

  const aInsertar = [...deseadas].filter((k) => !actuales.has(k));
  const aBorrar = [...actuales].filter((k) => !deseadas.has(k));

  if (aInsertar.length) {
    await crear(
      'booking_service_staff',
      aInsertar.map((k) => {
        const [booking_service_id, staff_id] = k.split('|');
        return { client_id: cliente.id, booking_service_id, staff_id };
      })
    );
  }

  for (const k of aBorrar) {
    const [servicioId, staffId] = k.split('|');
    await supabase(`booking_service_staff?booking_service_id=eq.${servicioId}&staff_id=eq.${staffId}`, {
      method: 'DELETE',
    });
  }

  console.log(`✓ matriz: ${deseadas.size} asignaciones (${aInsertar.length} nuevas, ${aBorrar.length} retiradas)`);

  console.log(`\nListo. Panel: /dashboard/${cliente.id}\n`);
  console.log('Queda por hacer:');
  console.log('  node scripts/cargar-prompt.js docs/prompt-peluqueria-mechas.md "Peluqueria Mechas"');
  console.log(`  node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "${CLIENTE}" --aplicar`);
  console.log('  y las credenciales de WhatsApp, cuando exista el número.');
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
