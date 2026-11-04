#!/usr/bin/env node
/**
 * Simula conversaciones de WhatsApp contra el bot de un cliente, de punta a
 * punta, sin mandar ningún mensaje ni escribir nada en la base.
 *
 *   node scripts/simular-conversacion.js "Peluqueria Mechas" guion.txt
 *   node scripts/simular-conversacion.js "Peluqueria Mechas" guion.txt --modelo gpt-5.5 --veces 3
 *   node scripts/simular-conversacion.js "Peluqueria Mechas" guion.txt --ahora "2026-11-04 08:49"
 *
 * Por qué existe. Hasta el 04/11/2026 la única forma de probar el bot entero
 * era desplegar y escribirle desde el móvil, y así se encontraron los fallos:
 * con una peluquería de verdad delante. Esto ejecuta EL MISMO CÓDIGO que n8n
 * —el `jsCode` de los nodos, leído de los JSON de `n8n/workflows/`, y el motor
 * de agenda— con los datos reales del cliente (prompt, conocimiento, servicios,
 * horarios y citas) y el mismo modelo. Lo único simulado es lo que escribe:
 *
 *   - Las citas que reserva, mueve o anula viven solo en memoria, durante esa
 *     conversación (y se respeta la regla de `agenda_reservar` de no dar una
 *     segunda cita del mismo servicio a quien ya tiene una).
 *   - No se guarda ningún mensaje ni se avisa a nadie: cuando el bot pasaría la
 *     conversación al equipo, se marca con [AVISO AL EQUIPO] y sigue.
 *
 * El guion: un mensaje de la persona por línea. `---` empieza otra
 * conversación (de cero). Las líneas con `#` son comentarios y se imprimen,
 * para escribir ahí lo que se espera. `@ahora 2026-11-04 08:49` fija la hora
 * de esa conversación, y `@cita 2026-11-05 16:00 Mechas medio casco` le pone
 * una cita previa a quien escribe.
 *
 * Los modelos no contestan siempre igual: `--veces 3` repite cada
 * conversación, y un fallo que sale una de tres veces es un fallo.
 *
 * Para probar un cambio antes de subirlo: `--prompt docs/prompt-x.md` usa el
 * prompt del repositorio y `--servicios docs/servicios-x.csv` sus duraciones y
 * alias, en vez de los que hay en la base. El código de los nodos ya es el del
 * repositorio siempre.
 */
const fs = require('fs');
const path = require('path');
const { clienteSupabase, cargarEnv, normalizar } = require('./lib/montar-demo');
const m = require('../n8n/logica/motor-agenda.js');

const RAIZ = path.resolve(__dirname, '..');
const ZONA = 'Europe/Madrid';
const CONTACTO = '34600000000';

const bot = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n/workflows/whatsapp-bot.json'), 'utf8'));
const agendaWf = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n/workflows/agenda-api.json'), 'utf8'));

function codigo(wf, nombre) {
  const n = wf.nodes.find((x) => x.name === nombre);
  if (!n || !n.parameters.jsCode) throw new Error('no existe el nodo Code ' + nombre);
  return n.parameters.jsCode;
}

// === $now de mentira ==========================================================
// En n8n es un DateTime de Luxon. Aquí basta con lo que usan los nodos:
// sumar, cambiar de zona e idioma, y unos pocos formatos.
function ahoraLuxon(ms) {
  const partes = (opc) => Object.fromEntries(
    new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, ...opc }).formatToParts(new Date(ms)).map((p) => [p.type, p.value])
  );
  const yo = {
    plus: (d) => ahoraLuxon(ms + ((d.days || 0) * 86400 + (d.seconds || 0)) * 1000),
    setLocale: () => yo,
    setZone: () => yo,
    toISO: () => new Date(ms).toISOString(),
    toMillis: () => ms,
    toFormat(f) {
      const p = partes({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      const dia = partes({ weekday: 'long' }).weekday;
      const mes = partes({ month: 'long' }).month;
      return f
        .replace(/'([^']*)'/g, (_, t) => '\u0000' + t.split('').join('\u0001') + '\u0000')
        .replace('cccc', dia).replace('LLLL', mes).replace('yyyy', p.year).replace('MM', p.month)
        .replace('dd', p.day).replace(/\bd\b/, String(Number(p.day))).replace('HH', p.hour).replace('mm', p.minute)
        .replace(/\u0000([^\u0000]*)\u0000/g, (_, t) => t.replace(/\u0001/g, ''));
    },
  };
  return yo;
}

/** Ejecuta un nodo Code con un $() que lee de `nodos` (cada valor, un item o una lista). */
function ejecutar(js, nodos, entrada, ahoraMs) {
  const items = (v) => (Array.isArray(v) ? v : [v]).map((json) => ({ json }));
  const $ = (nombre) => {
    if (!(nombre in nodos)) throw new Error('Referenced node is unexecuted: ' + nombre);
    const its = items(nodos[nombre]);
    return { first: () => its[0], all: () => its };
  };
  const ent = items(entrada === undefined ? {} : entrada);
  const $input = { first: () => ent[0], all: () => ent };
  return new Function('$', '$json', '$input', '$now', js)($, ent[0] && ent[0].json, $input, ahoraLuxon(ahoraMs))
    .map((i) => i.json);
}

// === Lo de fuera: Supabase y OpenAI ===========================================
const env = cargarEnv();
const supabase = clienteSupabase();
const rpc = (f, body) => supabase('rpc/' + f, { method: 'POST', body: JSON.stringify(body) });

async function openai(ruta, body) {
  for (let intento = 1; ; intento++) {
    const res = await fetch('https://api.openai.com/v1/' + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_API_KEY },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok || intento >= 3) return json;
  }
}

// === Una conversación =========================================================
async function conversar(cliente, guion, opciones) {
  const ahoraMs = guion.ahora || opciones.ahora || Date.now();
  const historial = []; // del más viejo al más nuevo: { role, content, sender, created_at }
  const citas = guion.citas.map((c, i) => Object.assign({ id: 'previa-' + i, contacto: CONTACTO, nombre_contacto: 'Prueba' }, c));

  const cfg = Object.assign({}, cliente.cfg, opciones.modelo ? { modelo: opciones.modelo } : {});
  const modulos = cliente.modulos.length ? cliente.modulos : [{}];

  for (const linea of guion.lineas) {
    if (linea.comentario) { console.log('   \x1b[2m# ' + linea.comentario + '\x1b[0m'); continue; }
    const texto = linea.texto;
    console.log('\x1b[36m👤 ' + texto + '\x1b[0m');
    const extraer = { message_text: texto, from: CONTACTO, contact_name: 'Prueba', client_id: cliente.id, adjunto: null };
    const nuevoPrimero = historial.slice().reverse();

    // Lo de antes de la IA.
    const recientes = nuevoPrimero.filter((x) => Date.parse(x.created_at) > ahoraMs - 6 * 3600e3).slice(0, 10);
    const nodos = {
      'Extraer mensaje': extraer,
      'Buscar cliente Whatsapp': { client_id: cliente.id },
      'Buscar prompt del cliente': cfg,
      'Mensajes recientes': recientes.length ? recientes : [{}],
    };
    const busqueda = ejecutar(codigo(bot, 'Preparar búsqueda'), nodos, modulos, ahoraMs)[0];
    nodos['Preparar búsqueda'] = busqueda;

    const emb = await openai('embeddings', { model: 'text-embedding-3-small', input: busqueda.textos_busqueda || [busqueda.pregunta] });
    const separadas = ejecutar(codigo(bot, 'Separar búsquedas'), nodos, emb, ahoraMs);
    let trozos = [];
    for (const s of separadas) {
      const r = await rpc('match_knowledge', { p_client_id: cliente.id, p_embedding: s.embedding, p_match_count: s.cuantos || 5, p_min_similarity: 0.2 });
      trozos = trozos.concat(r || []);
    }
    nodos['Recoger conocimiento'] = ejecutar(codigo(bot, 'Recoger conocimiento'), nodos, trozos.length ? trozos : [{}], ahoraMs)[0];

    const busquedasProd = ejecutar(codigo(bot, 'Separar búsquedas de productos'), nodos, {}, ahoraMs);
    let productos = [];
    for (const b of busquedasProd) {
      productos = productos.concat((await rpc('buscar_productos', { p_client_id: cliente.id, p_terminos: b.terminos || [], p_limite: b.limite || 0 })) || []);
    }
    nodos['Recoger productos'] = ejecutar(codigo(bot, 'Recoger productos'), nodos, productos.length ? productos : [{}], ahoraMs)[0];
    nodos['Cartera de inmuebles'] = busqueda.tiene_inmuebles ? await rpc('inmuebles_cartera', { p_client_id: cliente.id }) : {};
    nodos['Última búsqueda'] = cliente.ultimaBusqueda || {};

    // La agenda, igual que la Agenda API pero con las citas de esta prueba.
    const contexto = busqueda.tiene_agenda ? await cliente.contextoAgenda(ahoraMs, citas) : null;
    const agenda = (body) => agendaApi(contexto, body, citas, ahoraMs);
    nodos['Consultar agenda'] = busqueda.tiene_agenda
      ? agenda({ client_id: cliente.id, accion: 'disponibilidad', texto, textos_previos: busqueda.textos_previos || [] })
      : {};

    // La IA.
    const historialNodo = nuevoPrimero.slice(0, 12);
    nodos['Cargar historial'] = historialNodo.length ? historialNodo : [{}];
    const ctx = ejecutar(codigo(bot, 'Preparar contexto'), nodos, historialNodo.length ? historialNodo : [{}], ahoraMs)[0];
    nodos['Preparar contexto'] = ctx;
    if (opciones.verContexto) {
      for (const msg of ctx.messages.filter((x) => x.role === 'system').slice(-3)) console.log('\x1b[2m' + msg.content + '\x1b[0m');
    }
    const cuerpo = Object.assign(
      { model: ctx.modelo || 'gpt-4o', response_format: { type: 'json_object' }, messages: ctx.messages },
      /^gpt-5/.test(ctx.modelo || '') ? { reasoning_effort: 'low' } : {}
    );
    const respuesta = await openai('chat/completions', cuerpo);
    const ia = ejecutar(codigo(bot, 'Parsear respuesta IA'), nodos, respuesta, ahoraMs)[0];
    nodos['Parsear respuesta IA'] = ia;
    if (opciones.verIa) console.log('\x1b[2m   IA: ' + JSON.stringify(ia) + '\x1b[0m');
    const decision = ejecutar(codigo(bot, 'Decidir acción'), nodos, ia, ahoraMs)[0];
    nodos['Decidir acción'] = decision;

    let salida;
    if (decision.accion !== 'ninguna') {
      const r = agenda({
        client_id: cliente.id, accion: decision.accion, confirmar: decision.confirmar === true,
        fecha: decision.fecha || null, hora: decision.hora || null, email: decision.email || null,
        contacto: CONTACTO, nombre: 'Prueba', motivo: decision.motivo || '',
        servicios: decision.servicios || (decision.servicio ? [decision.servicio] : []),
        trabajador: decision.trabajador || '', texto, textos_previos: busqueda.textos_previos || [],
      });
      salida = ejecutar(codigo(bot, 'Respuesta con agenda'), nodos, r, ahoraMs)[0];
    } else if (decision.inmuebles) {
      const r = await rpc('buscar_inmuebles', { p_client_id: cliente.id, p_filtros: decision.inmuebles, p_limite: 3 });
      salida = ejecutar(codigo(bot, 'Respuesta con inmuebles'), nodos, r, ahoraMs)[0];
      cliente.ultimaBusqueda = { filtros: decision.inmuebles, updated_at: new Date(ahoraMs).toISOString() };
    } else {
      salida = ejecutar(codigo(bot, 'Respuesta sin agenda'), nodos, {}, ahoraMs)[0];
    }
    const final = ejecutar(codigo(bot, 'Respuesta final'), nodos, salida, ahoraMs)[0];

    const marcas = [];
    if (decision.accion !== 'ninguna') marcas.push('agenda: ' + decision.accion + ' ' + (decision.fecha || '-') + ' ' + (decision.hora || '-') + ' [' + (decision.servicios || []).join(' + ') + ']');
    if (final.escalar || decision.escalar) marcas.push('AVISO AL EQUIPO');
    if (ia.fallo_ia) marcas.push('FALLO IA: ' + ia.fallo_ia);
    console.log('\x1b[32m🤖 ' + final.reply.replace(/\n/g, '\n   ') + '\x1b[0m' + (marcas.length ? '\n   \x1b[33m[' + marcas.join(' | ') + ']\x1b[0m' : ''));

    const t = new Date(ahoraMs + historial.length * 20000);
    historial.push({ role: 'user', content: texto, sender: 'contact', created_at: t.toISOString() });
    historial.push({ role: 'assistant', content: final.reply, sender: 'bot', created_at: new Date(t.getTime() + 1000).toISOString() });
  }
}

// === La Agenda API, con las citas en memoria ==================================
function agendaApi(contexto, body, citas, ahoraMs) {
  const pet = ejecutar(codigo(agendaWf, 'Leer petición'), {}, { body }, ahoraMs)[0];
  const suyas = citas.filter((c) => c.estado !== 'cancelada' && Date.parse(c.fin) > ahoraMs);
  const d = Object.assign({}, m.resolver(contexto, Object.assign({}, pet, { citas: suyas }), ahoraMs), {
    accion: pet.accion, confirmar: pet.confirmar === true, contacto: pet.contacto,
    nombre_contacto: pet.nombre, nombrar: (contexto.trabajadores || []).length > 1, zona: ZONA,
  });

  if (d.accion === 'reservar' && d.estado === 'libre') {
    // La regla de `agenda_reservar` (0035): si ya tiene una cita futura con
    // alguno de estos servicios, no se le da otra.
    const ids = (d.servicios || []).map((s) => s.id);
    const previa = suyas.find((c) => !ids.length || !(c.servicios || []).length || c.servicios.some((s) => ids.includes(s.id)));
    if (previa) {
      const nodos = { Decidir: d, Reservar: { ok: false, motivo: 'ya_tiene_cita', cita_id: previa.id, cita_inicio: previa.inicio, cita_con: previa.staff_nombre, cita_servicios: (previa.servicios || []).map((s) => s.nombre) } };
      return ejecutar(codigo(agendaWf, 'Respuesta hueco perdido'), nodos, {}, ahoraMs)[0];
    }
    const nueva = { id: 'sim-' + citas.length, inicio: d.inicio, fin: d.fin, staff_id: d.trabajador.id, staff_nombre: d.trabajador.nombre, servicios: d.servicios, contacto: CONTACTO, nombre_contacto: 'Prueba' };
    citas.push(nueva);
    return ejecutar(codigo(agendaWf, 'Respuesta reservada'), { Decidir: d, Reservar: { ok: true, id: nueva.id } }, {}, ahoraMs)[0];
  }
  if (d.accion === 'mover' && d.estado === 'libre' && d.confirmar && d.cita_id) {
    // El mensaje antes de moverla: dice «de cuándo a cuándo», y el «de cuándo»
    // es la cita tal y como estaba (en n8n viene de la base, ya leída).
    const respuesta = ejecutar(codigo(agendaWf, 'Respuesta movida'), { Decidir: JSON.parse(JSON.stringify(d)) }, {}, ahoraMs)[0];
    const c = citas.find((x) => x.id === d.cita_id);
    Object.assign(c, { inicio: d.inicio, fin: d.fin, staff_id: d.trabajador.id, staff_nombre: d.trabajador.nombre });
    return respuesta;
  }
  if (d.accion === 'anular' && d.estado === 'anulable' && d.confirmar) {
    citas.find((x) => x.id === d.cita_id).estado = 'cancelada';
    return ejecutar(codigo(agendaWf, 'Respuesta anulada'), { Decidir: d }, {}, ahoraMs)[0];
  }
  return ejecutar(codigo(agendaWf, 'Respuesta del motor'), {}, d, ahoraMs)[0];
}

// === Arranque =================================================================
function leerGuion(ruta) {
  const conversaciones = [{ lineas: [], citas: [] }];
  for (const cruda of fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const l = cruda.trim();
    const actual = conversaciones[conversaciones.length - 1];
    if (!l) continue;
    if (l === '---') { conversaciones.push({ lineas: [], citas: [] }); continue; }
    if (l.startsWith('#')) { actual.lineas.push({ comentario: l.replace(/^#+\s*/, '') }); continue; }
    let a = l.match(/^@ahora\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/);
    if (a) { actual.ahora = m.instante(a[1], a[2].padStart(5, '0'), ZONA); continue; }
    a = l.match(/^@cita\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/);
    if (a) { actual.citas.push({ fecha: a[1], hora: a[2], servicio: a[3] }); continue; }
    actual.lineas.push({ texto: l });
  }
  return conversaciones.filter((c) => c.lineas.some((x) => x.texto));
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : process.argv[i + 1];
}

async function main() {
  const [nombre, rutaGuion] = process.argv.slice(2).filter((a, i, t) => !a.startsWith('--') && !(t[i - 1] || '').startsWith('--'));
  if (!nombre || !rutaGuion) throw new Error('Uso: node scripts/simular-conversacion.js "<cliente>" <guion.txt> [--modelo gpt-5.5] [--veces 3] [--ahora "AAAA-MM-DD HH:MM"] [--contexto]');

  const clientes = await supabase('clients?select=id,name');
  const c = clientes.find((x) => normalizar(x.name) === normalizar(nombre));
  if (!c) throw new Error('no hay ningún cliente que se llame "' + nombre + '"');
  const [cfg] = await supabase('agent_configs?client_id=eq.' + c.id + '&select=*');

  // Probar antes de subir: el prompt y los alias del repositorio en vez de los
  // que hay en la base. Sin esto, cambiar el prompt para probarlo era cambiarlo
  // en producción.
  const rutaPrompt = argumento('--prompt');
  if (rutaPrompt) {
    const md = fs.readFileSync(path.resolve(RAIZ, rutaPrompt), 'utf8').replace(/\r\n/g, '\n');
    const bloque = [...md.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((b) => b[1].trim()).find((b) => b.startsWith('['));
    if (!bloque) throw new Error('no encuentro el prompt en ' + rutaPrompt);
    cfg.system_prompt = bloque;
  }
  const rutaServicios = argumento('--servicios');
  const aliasDelCsv = new Map();
  if (rutaServicios) {
    for (const linea of fs.readFileSync(path.resolve(RAIZ, rutaServicios), 'utf8').trim().split(/\r?\n/).slice(1)) {
      const campos = linea.split(',').map((x) => x.trim());
      aliasDelCsv.set(normalizar(campos[0]), { duracion_min: Number(campos[1]), alias: campos.slice(2).filter(Boolean) });
    }
  }
  const modulos = await supabase('client_modules?client_id=eq.' + c.id + '&active=is.true&select=module,sinonimos:config->catalog_sinonimos');

  const cliente = {
    id: c.id, cfg, modulos,
    async contextoAgenda(ahoraMs, citas) {
      const ctx = await rpc('agenda_contexto', { p_client_id: c.id, p_desde: new Date(ahoraMs - 2 * 3600e3).toISOString(), p_hasta: new Date(ahoraMs + 9 * 86400e3).toISOString() });
      for (const s of ctx.servicios || []) Object.assign(s, aliasDelCsv.get(normalizar(s.nombre)) || {});
      // Las citas de la prueba ocupan su hueco como cualquier otra.
      for (const cita of citas) {
        if (cita.fecha) {
          // Una @cita del guion: se le busca quien la pueda hacer, como el panel.
          const s = ctx.servicios.find((x) => normalizar(x.nombre) === normalizar(cita.servicio));
          if (!s) throw new Error('@cita: no existe el servicio ' + cita.servicio);
          const t = ctx.trabajadores.find((x) => (s.staff || []).includes(x.id));
          cita.inicio = new Date(m.instante(cita.fecha, cita.hora.padStart(5, '0'), ZONA)).toISOString();
          cita.fin = new Date(Date.parse(cita.inicio) + s.duracion_min * 60000).toISOString();
          Object.assign(cita, { staff_id: t.id, staff_nombre: t.nombre, servicios: [{ id: s.id, nombre: s.nombre, duracion_min: s.duracion_min }] });
          delete cita.fecha;
        }
        if (cita.estado === 'cancelada') continue;
        const t = ctx.trabajadores.find((x) => x.id === cita.staff_id);
        if (t) t.citas = (t.citas || []).filter((x) => x.id !== cita.id).concat([{ id: cita.id, inicio: cita.inicio, fin: cita.fin }]);
      }
      return ctx;
    },
  };

  const ahora = argumento('--ahora');
  const opciones = {
    modelo: argumento('--modelo'),
    ahora: ahora ? m.instante(ahora.slice(0, 10), ahora.slice(11).padStart(5, '0'), ZONA) : null,
    verContexto: process.argv.includes('--contexto'),
    verIa: process.argv.includes('--ia'),
  };
  const veces = Number(argumento('--veces') || 1);

  console.log(`Cliente ${c.name} · modelo ${opciones.modelo || cfg.modelo || 'gpt-4o'}`);
  const conversaciones = leerGuion(rutaGuion);
  for (let n = 0; n < conversaciones.length; n++) {
    for (let v = 1; v <= veces; v++) {
      console.log(`\n\x1b[1m=== Conversación ${n + 1}${veces > 1 ? ` (vez ${v} de ${veces})` : ''} ===\x1b[0m`);
      await conversar(cliente, conversaciones[n], opciones);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
