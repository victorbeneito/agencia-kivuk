/**
 * Monta (o repone) un cliente de demostración a partir de su definición.
 *
 * Es lo común de `montar-demo-peluqueria.js` y `montar-demo-clinica.js`: cada
 * uno de esos scripts solo describe su negocio —horario, equipo, quién hace
 * qué— y llama a `montarDemo`. Hace lo mismo que haría alguien pinchando en el
 * panel, pero de una vez: el alta del cliente, sus dos módulos, el horario del
 * negocio, el equipo con su horario día a día, los servicios del CSV y la
 * matriz de quién hace qué.
 *
 * Es idempotente: empareja por nombre (cliente, trabajador, servicio) y
 * actualiza en vez de duplicar, así que también sirve para devolver la demo a
 * su estado de fábrica después de haberla enseñado.
 *
 * Lo que NO toca: las credenciales de WhatsApp y de Google, el prompt y el
 * conocimiento. El prompt y el conocimiento tienen sus propios cargadores, y el
 * número se mueve con `pasar-numero-demo.js`.
 *
 * Definición:
 *   cliente          nombre exacto, sin tildes (así lo buscan los scripts)
 *   csvServicios     ruta del CSV desde la raíz del repo
 *   moduloCalendar   horario del negocio, tal cual va en client_modules.config
 *   equipo           [{ nombre, orden, horario: { dia: [[inicio, fin], ...] } }]
 *   soloLosHacen     { 'Servicio': ['Nombre', ...] }; lo que no está, lo hacen todos
 *   siguientes       líneas que se imprimen al final como "queda por hacer"
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
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

function clienteSupabase() {
  const env = cargarEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })) {
    if (!v) throw new Error(`falta ${k} en app/.env.local`);
  }

  return async function supabase(ruta, opciones = {}) {
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
  };
}

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
function leerServicios(csv) {
  const lineas = leerTexto(path.join(RAIZ, csv)).trim().split('\n');
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

const NOMBRE_DIA = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado' };

// --- programa ------------------------------------------------------------

async function montarDemo(def) {
  const aplicar = process.argv.includes('--aplicar');
  const servicios = leerServicios(def.csvServicios);
  const cal = def.moduloCalendar;
  const dias = cal.dias_laborables.split(',').map((d) => NOMBRE_DIA[d]).join(', ');

  console.log(`Cliente de demostración: ${def.cliente}\n`);
  console.log(`  módulos      whatsapp (sin credenciales todavía), calendar`);
  console.log(`  horario      ${dias}; ${cal.manana_inicio}-${cal.manana_fin} y ${cal.tarde_inicio}-${cal.tarde_fin}`);
  console.log(`  equipo       ${def.equipo.map((t) => t.nombre).join(', ')}`);
  console.log(`  servicios    ${servicios.length} desde ${def.csvServicios}`);

  const malos = servicios.filter((s) => !s.nombre || !Number.isInteger(s.duracion_min) || s.duracion_min <= 0);
  if (malos.length) throw new Error(`el CSV tiene ${malos.length} fila(s) sin nombre o sin duración válida`);

  const desconocidos = Object.keys(def.soloLosHacen).filter(
    (n) => !servicios.some((s) => normalizar(s.nombre) === normalizar(n))
  );
  if (desconocidos.length) {
    // Un servicio de la matriz que no está en el CSV no da error en la base:
    // simplemente no se asigna a nadie, y queda reservable por todos.
    throw new Error(`la matriz nombra servicios que no están en el CSV: ${desconocidos.join(', ')}`);
  }

  const nombresEquipo = new Set(def.equipo.map((t) => t.nombre));
  const ajenos = Object.values(def.soloLosHacen).flat().filter((n) => !nombresEquipo.has(n));
  if (ajenos.length) throw new Error(`la matriz nombra a gente que no está en el equipo: ${[...new Set(ajenos)].join(', ')}`);

  const supabase = clienteSupabase();
  const crear = (tabla, filas) =>
    supabase(tabla, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(filas),
    });

  const agencias = await supabase('agencies?select=id,name');
  if (!agencias.length) throw new Error('no hay ninguna agencia en la base');
  if (agencias.length > 1) throw new Error(`hay ${agencias.length} agencias; este script asume una sola`);
  const agencia = agencias[0];
  console.log(`  agencia      ${agencia.name}`);

  const existentes = await supabase(`clients?name=ilike.${encodeURIComponent(def.cliente)}&select=id,name`);
  console.log(`\n${existentes.length ? `Ya existe (${existentes[0].id}): se actualiza.` : 'No existe todavía: se crea.'}`);

  if (!aplicar) {
    console.log('\nEsto es una simulación. Vuelve a lanzarlo con --aplicar para escribirlo.');
    return;
  }

  // --- cliente -----------------------------------------------------------
  let cliente = existentes[0];
  if (!cliente) {
    cliente = (await crear('clients', { agency_id: agencia.id, name: def.cliente }))[0];
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

  // `on_conflict` hace falta: la clave primaria es `id`, y sin él PostgREST
  // intenta insertar y choca con el unique (client_id, module) en cuanto el
  // cliente ya existe, que es justo el caso de "devolver la demo a fábrica".
  await supabase('client_modules?on_conflict=client_id,module', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([
      { client_id: cliente.id, module: 'whatsapp', active: true, config: modulos.find((m) => m.module === 'whatsapp')?.config ?? {} },
      // Se fusiona sobre lo que hubiera: si algún día se conecta Google, sus
      // credenciales viven en este mismo campo.
      { client_id: cliente.id, module: 'calendar', active: true, config: { ...configCalendar, ...cal } },
    ]),
  });
  console.log('✓ módulos whatsapp y calendar activos, con el horario del negocio');

  // --- equipo ------------------------------------------------------------
  const staffPrevio = await supabase(`staff?client_id=eq.${cliente.id}&select=id,nombre`);
  const staffPorNombre = new Map(staffPrevio.map((s) => [normalizar(s.nombre), s]));
  const idPorNombre = new Map();

  for (const t of def.equipo) {
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

  const sobran = staffPrevio.filter((s) => !def.equipo.some((t) => normalizar(t.nombre) === normalizar(s.nombre)));
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
    const quienes = def.soloLosHacen[s.nombre] ?? def.equipo.map((t) => t.nombre);
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
  for (const linea of def.siguientes) console.log(`  ${linea}`);
}

function lanzar(def) {
  montarDemo(def).catch((e) => {
    console.error(`\n✖ ${e.message}`);
    process.exit(1);
  });
}

module.exports = { montarDemo, lanzar, clienteSupabase, normalizar };
