/**
 * Prueba el pegamento entre el motor y n8n.
 *
 *     node n8n/logica/nodos.prueba.js
 *
 * Ejecuta el `jsCode` de los nodos Code TAL COMO ha quedado dentro de
 * `agenda-api.json`, con un `$()` de mentira. Es lo unico que comprueba lo que
 * las pruebas del motor no pueden ver: que los nombres de nodo esten bien
 * escritos, que un nodo que no se ha ejecutado no reviente la ejecucion, y que
 * la salida de cada nodo tenga la forma que espera el siguiente.
 *
 * `contexto-ejemplo.json` es la salida REAL de `agenda_contexto` para una
 * peluqueria de tres personas. Vale ademas como documentacion del contrato
 * entre la funcion de Postgres y el motor: si alguien cambia una, esto falla.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n", "workflows", "agenda-api.json"), "utf8"));
const contexto = JSON.parse(fs.readFileSync(path.join(__dirname, "contexto-ejemplo.json"), "utf8"));

let fallos = 0;
function ok(t, c, d) {
  if (c) console.log("  OK   " + t);
  else { fallos++; console.log("  FALLO " + t + (d ? "\n        -> " + d : "")); }
}

function nodo(nombre) {
  const n = wf.nodes.find((x) => x.name === nombre);
  if (!n) throw new Error("no existe el nodo " + nombre);
  return n.parameters.jsCode;
}

/** Ejecuta un jsCode con un $(), un $json y un $input falsos. */
function ejecutar(nombreNodo, entradas, jsonEntrada) {
  const $ = (nombre) => {
    if (!(nombre in entradas)) {
      // n8n lanza si el nodo no se ha ejecutado; el codigo debe sobrevivir.
      throw new Error("Referenced node is unexecuted: " + nombre);
    }
    return { first: () => ({ json: entradas[nombre] }), all: () => [{ json: entradas[nombre] }] };
  };
  const $input = {
    first: () => ({ json: jsonEntrada }),
    all: () => [{ json: jsonEntrada }],
  };
  const fn = new Function("$", "$json", "$input", "$now", nombreNodo);
  return fn($, jsonEntrada, $input, AHORA);
}

/**
 * El `$now` de n8n es un DateTime de Luxon. Aqui basta con que responda a lo
 * que usa el codigo: sumar dias y formatear. Da igual que siempre diga lo
 * mismo; lo que se comprueba es que el nodo no reviente y arme el contexto.
 */
const AHORA = {
  plus: () => ({
    setLocale: () => ({ toFormat: () => "lunes" }),
    toFormat: () => "2026-09-14",
  }),
  setLocale: () => ({ toFormat: () => "viernes" }),
  toFormat: () => "2026-09-11",
};


// El martes que viene (o el de hoy en 6 dias): dentro de la ventana de 7 dias
// que mira el motor, que es lo que se le pide de verdad.
const m = require("./motor-agenda.js");
const ZONA = "Europe/Madrid";
function proximoDia(iso) {
  for (let i = 1; i < 7; i++) {  // desde manana: hoy las horas ya pueden haber pasado
    const f = m.fechaSumando(Date.now(), i, ZONA);
    if (m.diaSemanaDe(f, ZONA) === iso) return f;
  }
  return m.fechaSumando(Date.now(), 1, ZONA);
}
const MIERCOLES = proximoDia(3);

const PET = {
  client_id: "00000000-0000-0000-0000-0000000000c1",
  cliente_valido: true,
  accion: "reservar",
  fecha: MIERCOLES,
  hora: "17:00",
  email: "cliente@correo.com",
  contacto: "34600111222",
  nombre: "Marta",
  servicios: ["lavado", "corte", "mechas"],
  trabajador: "",
  motivo: "",
  canal: "whatsapp",
  conversation_id: null,
};

console.log("=== Nodo 'Leer petición' ===");
let r = ejecutar(nodo("Leer petición"), {}, {
  body: { client_id: PET.client_id, accion: "reservar", servicios: "mechas", trabajador: "Ana" },
});
ok("deja los servicios siempre como lista", Array.isArray(r[0].json.servicios) && r[0].json.servicios[0] === "mechas", JSON.stringify(r[0].json.servicios));
ok("acepta 'servicio' en singular", ejecutar(nodo("Leer petición"), {}, { body: { client_id: PET.client_id, servicio: "corte" } })[0].json.servicios[0] === "corte");
ok("un client_id que no es uuid se marca invalido", ejecutar(nodo("Leer petición"), {}, { body: { client_id: "pepe" } })[0].json.cliente_valido === false);

console.log("\n=== Nodo 'Decidir' CON freeBusy de Google ===");
const conGoogle = {
  "Leer petición": PET,
  "Cargar contexto": contexto,
  "Cargar ocupación": { calendars: { "bea@group.calendar.google.com": { busy: [
    { start: new Date(m.instante(MIERCOLES, "16:00", ZONA)).toISOString(), end: new Date(m.instante(MIERCOLES, "20:00", ZONA)).toISOString() },
  ] } } },
};
r = ejecutar(nodo("Decidir"), conGoogle, {});
ok("el bloqueo de Bea en Google la descarta", r[0].json.trabajador && r[0].json.trabajador.nombre !== "Bea", JSON.stringify(r[0].json.trabajador) + " " + r[0].json.mensaje);
ok("y la cita se la queda otra persona", r[0].json.estado === "libre", r[0].json.estado + " " + r[0].json.mensaje);

console.log("\n=== Nodo 'Decidir' SIN Google (nodo no ejecutado) ===");
r = ejecutar(nodo("Decidir"), { "Leer petición": PET, "Cargar contexto": contexto }, {});
ok("sobrevive a que 'Cargar ocupación' no se haya ejecutado", r[0].json.estado === "libre", r[0].json.estado);
ok("165 minutos", r[0].json.duracion_min === 165, String(r[0].json.duracion_min));
ok("arrastra el contacto para agenda_reservar", r[0].json.contacto === "34600111222", r[0].json.contacto);
ok("arrastra el nombre", r[0].json.nombre_contacto === "Marta", r[0].json.nombre_contacto);
ok("dice que hay que nombrar (3 trabajadoras)", r[0].json.nombrar === true);
ok("trae inicio y fin ISO para el RPC", !!r[0].json.inicio && !!r[0].json.fin, r[0].json.inicio + " " + r[0].json.fin);
ok("trae el id del trabajador para el RPC", !!(r[0].json.trabajador && r[0].json.trabajador.id), JSON.stringify(r[0].json.trabajador));

console.log("\n=== Nodo 'Decidir' con Google caido (respuesta de error) ===");
r = ejecutar(nodo("Decidir"), {
  "Leer petición": PET, "Cargar contexto": contexto,
  "Cargar ocupación": { error: "401 Unauthorized" },
}, {});
ok("un error de Google no deja al negocio sin citas", r[0].json.estado === "libre", r[0].json.estado);

console.log("\n=== Nodo 'Respuesta reservada' ===");
const decision = r[0].json;
r = ejecutar(nodo("Respuesta reservada"), {
  Decidir: decision,
  Reservar: { ok: true, id: "11111111-2222-3333-4444-555555555555" },
}, {});
ok("marca reservada", r[0].json.reservada === true);
ok("devuelve el id de la cita", r[0].json.cita_id === "11111111-2222-3333-4444-555555555555");
ok("el mensaje dice con quien y que", /con \w+ \(Lavado \+ Corte \+ Corte y mechas\)/.test(r[0].json.mensaje), r[0].json.mensaje);

console.log("\n=== Nodo 'Respuesta hueco perdido' ===");
r = ejecutar(nodo("Respuesta hueco perdido"), { Decidir: decision }, {});
ok("no dice que sea un error", r[0].json.ok === true && r[0].json.reservada === false, JSON.stringify(r[0].json));
ok("pide otra hora", /Dime otra hora/.test(r[0].json.mensaje), r[0].json.mensaje);
ok("y sobrevive si 'Reservar' no se ha ejecutado", r[0].json.motivo === "ocupado", r[0].json.motivo);

// La otra forma de no reservar: quien escribe ya tenia una cita. El bot no sabe
// cambiarlas, asi que en vez de ponerle otra encima avisa a una persona.
r = ejecutar(nodo("Respuesta hueco perdido"), {
  Decidir: Object.assign({}, decision, { zona: "Europe/Madrid" }),
  Reservar: {
    ok: false,
    motivo: "ya_tiene_cita",
    cita_id: "99999999-8888-7777-6666-555555555555",
    cita_inicio: "2026-09-29T15:00:00+00:00",
    cita_con: "Elena",
  },
}, {});
ok("no reserva la segunda", r[0].json.reservada === false && r[0].json.motivo === "ya_tiene_cita", JSON.stringify(r[0].json));
ok("avisa al equipo", r[0].json.escalar === true, JSON.stringify(r[0].json.escalar));
ok("dice cuando es la que ya tiene, en hora de Madrid",
  /martes 29-09-2026 a las 17:00/.test(r[0].json.mensaje), r[0].json.mensaje);
ok("y con quien", /con Elena/.test(r[0].json.mensaje), r[0].json.mensaje);

console.log("\n=== Mover una cita ===");
// La cita que ya tiene esa persona, tal y como la devuelve `agenda_cita_futura`.
const SU_CITA = {
  id: "cc000000-0000-4000-8000-000000000001",
  inicio: "2026-09-16T15:00:00+00:00",
  fin: "2026-09-16T15:30:00+00:00",
  staff_id: "e3526d7b-2d79-4aba-8e1b-a538fef2b7d3",
  staff_nombre: "Ana",
  nombre_contacto: "Marta",
  contacto: "34600111222",
  notas: "",
  google_event_id: null,
  servicios: [{ id: "00000000-0000-0000-0000-0000000000f2", nombre: "Corte", duracion_min: 30 }],
};

const decidirMover = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, {
    accion: "mover",
    fecha: proximoDia("2026-09-17"),
    hora: "10:00",
    servicios: [],
    confirmar: true,
  }),
  "Cargar contexto": contexto,
  "Buscar su cita": SU_CITA,
}, {})[0].json;

ok("el nodo Decidir recoge la cita de esa persona", decidirMover.mover === true, JSON.stringify(decidirMover.estado));
ok("y arrastra el confirmar para saber si hay que tocarla", decidirMover.confirmar === true, JSON.stringify(decidirMover.confirmar));
ok("con su duracion, no la de por defecto", decidirMover.duracion_min === 30, String(decidirMover.duracion_min));

// Sin cita ninguna: el nodo 'Buscar su cita' devuelve un item vacio.
const sinCita = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "mover", confirmar: true }),
  "Cargar contexto": contexto,
  "Buscar su cita": {},
}, {})[0].json;
ok("sin cita que mover, lo pasa a una persona", sinCita.estado === "sin_cita" && sinCita.escalar === true, sinCita.estado);

r = ejecutar(nodo("Respuesta movida"), {
  Decidir: Object.assign({}, decidirMover, { cita: SU_CITA, nombrar: true }),
}, {});
ok("el mensaje del cambio dice de cuando a cuando",
  /16-09-2026 a las 17:00/.test(r[0].json.mensaje) && /a las 10:00/.test(r[0].json.mensaje), r[0].json.mensaje);
ok("y se marca como movida, no como reservada",
  r[0].json.movida === true && r[0].json.reservada === false, JSON.stringify(r[0].json.movida));

r = ejecutar(nodo("Respuesta no movida"), {
  Decidir: decidirMover,
  "Mover cita": { ok: false, motivo: "ocupado" },
}, {});
ok("si se lo han quitado por el camino, pide otra hora", /Dime otra/.test(r[0].json.mensaje), r[0].json.mensaje);
ok("y eso no se escala: se sigue hablando", r[0].json.escalar === false, JSON.stringify(r[0].json.escalar));

r = ejecutar(nodo("Respuesta no movida"), {
  Decidir: decidirMover,
  "Mover cita": { ok: false, motivo: "cancelada" },
}, {});
ok("cualquier otro motivo sí se escala", r[0].json.escalar === true, JSON.stringify(r[0].json.escalar));

r = ejecutar(nodo("Respuesta movida"), {
  Decidir: Object.assign({}, decidirMover, { cita: SU_CITA, nombrar: true }),
}, {});
ok("el negocio recibe un aviso del cambio, con el nombre y las dos horas",
  r[0].json.aviso && r[0].json.aviso.titulo === "Cita cambiada" &&
  /Marta/.test(r[0].json.aviso.cuerpo) && /16-09-2026 17:00/.test(r[0].json.aviso.cuerpo),
  JSON.stringify(r[0].json.aviso));

console.log("\n=== Anular una cita ===");
const decidirAnular = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "anular", confirmar: false }),
  "Cargar contexto": contexto,
  "Buscar su cita": SU_CITA,
}, {})[0].json;
ok("con una cita, la deja lista para anular", decidirAnular.estado === "anulable" && decidirAnular.anular === true, decidirAnular.estado);
ok("y pregunta antes de hacerlo", /¿Seguro/.test(decidirAnular.mensaje), decidirAnular.mensaje);

r = ejecutar(nodo("Respuesta del motor"), {}, decidirAnular);
ok("la pregunta llega al bot marcada como anular", r[0].json.anular === true && r[0].json.estado === "anulable", JSON.stringify(r[0].json.estado));

r = ejecutar(nodo("Respuesta anulada"), { Decidir: decidirAnular }, {});
ok("anulada: se lo dice diciendo cual era", /he anulado tu cita del/.test(r[0].json.mensaje) && r[0].json.anulada === true, r[0].json.mensaje);
ok("y avisa al negocio de que el hueco queda libre",
  r[0].json.aviso && r[0].json.aviso.titulo === "Cita anulada" && /hueco queda libre/.test(r[0].json.aviso.cuerpo),
  JSON.stringify(r[0].json.aviso));

console.log("\n=== Nodo 'Respuesta del motor' (disponibilidad) ===");
const disp = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "disponibilidad", fecha: null, hora: null, servicios: [] }),
  "Cargar contexto": contexto,
}, {})[0].json;
r = ejecutar(nodo("Respuesta del motor"), {}, disp);
ok("devuelve dias con huecos", Array.isArray(r[0].json.dias) && r[0].json.dias.length > 0, String((r[0].json.dias || []).length));
ok("con mensaje ya redactado", typeof r[0].json.mensaje === "string" && r[0].json.mensaje.length > 10, r[0].json.mensaje.slice(0, 120));
// El bot pinta con esto la lista de lo que se puede reservar. Se perdia aqui,
// en el nodo que copia campo a campo, y no llego al bot del 11/09 al 06/10.
ok("deja pasar el catalogo de servicios hasta el bot",
  Array.isArray(r[0].json.catalogo) && r[0].json.catalogo.length === (disp.catalogo || []).length && r[0].json.catalogo.length > 0,
  JSON.stringify(r[0].json.catalogo));
console.log("\n  --- lo que leeria el bot ---\n  " + r[0].json.mensaje.split("\n").join("\n  "));

console.log("\n=== Compatibilidad con el bot que hay en produccion ===");
// El nodo "Respuesta con agenda" del whatsapp-bot lee `api.libre` para saber
// cuando pedir el email. Si esta API deja de devolverlo, el bot deja de pedir el
// correo y las citas se crean sin confirmacion, sin que falle nada visible.
const libreSinEmail = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "comprobar", email: null, servicios: ["corte"] }),
  "Cargar contexto": contexto,
}, {})[0].json;
r = ejecutar(nodo("Respuesta del motor"), {}, libreSinEmail);
ok("devuelve `libre` cuando el hueco esta libre", r[0].json.libre === true, JSON.stringify({ estado: r[0].json.estado, libre: r[0].json.libre }));
ok("y `reservada` en false", r[0].json.reservada === false);

// Reservar sin correo ya no se para: la confirmacion la lee en el mismo chat.
const sinEmail = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "reservar", email: null, servicios: ["corte"] }),
  "Cargar contexto": contexto,
}, {})[0].json;
ok("reservar sin correo llega a 'libre', que es lo que dispara la reserva",
   sinEmail.estado === "libre", sinEmail.estado);
r = ejecutar(nodo("Respuesta del motor"), {}, sinEmail);
ok("y el mensaje no le pide el correo", !/correo|email/i.test(r[0].json.mensaje), r[0].json.mensaje);

// Pero reservar sin decir que se hace sigue parandose: la duracion depende de
// eso, y una cita de 60 minutos donde hacian falta 120 se come la siguiente.
const sinServicio = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "reservar", email: null, servicios: [] }),
  "Cargar contexto": contexto,
}, {})[0].json;
ok("reservar sin servicio se queda en 'falta_servicio'",
   sinServicio.estado === "falta_servicio", sinServicio.estado);
r = ejecutar(nodo("Respuesta del motor"), {}, sinServicio);
ok("y NO marca libre, para que el bot no dé la cita por hecha",
   r[0].json.libre === false, JSON.stringify({ estado: r[0].json.estado, libre: r[0].json.libre }));

// La pista de `texto`: el bot la manda antes de que la IA conteste.
const porTexto = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, {
    accion: "disponibilidad", fecha: null, hora: null, email: null,
    servicios: [], texto: "hola, queria unas mechas",
  }),
  "Cargar contexto": contexto,
}, {})[0].json;
ok("el nodo pasa `texto` al motor y sale la duracion de las mechas",
   porTexto.duracion_min === 120, String(porTexto.duracion_min));

// === La ventana de datos =====================================================
// Si no cubre el dia que piden, las citas de ese dia no se cargan y el motor lo
// ve vacio: contestaria "esta libre" de una hora que ya tiene a alguien.

console.log("\n=== La ventana de datos que se carga ===");

function leerPeticion(body) {
  return ejecutar(nodo("Leer petición"), {}, { body })[0].json;
}

const cerca = leerPeticion({ client_id: PET.client_id, accion: "disponibilidad" });
const nueveDias = (new Date(cerca.hasta) - Date.now()) / 86400000;
ok("sin fecha, se cargan unos nueve dias", nueveDias > 8.9 && nueveDias < 9.1, String(nueveDias));

const lejos = leerPeticion({ client_id: PET.client_id, accion: "comprobar", fecha: "2026-12-20", hora: "10:00" });
ok("con una fecha lejana, la ventana llega hasta ese dia",
   lejos.hasta.slice(0, 10) === "2026-12-20", lejos.hasta);

const disparate = leerPeticion({ client_id: PET.client_id, accion: "comprobar", fecha: "2099-01-01", hora: "10:00" });
const tope = (new Date(disparate.hasta) - Date.now()) / 86400000;
ok("una fecha disparatada no se trae anios de agenda", tope < 121, String(tope));

const pasado = leerPeticion({ client_id: PET.client_id, accion: "comprobar", fecha: "2020-01-01", hora: "10:00" });
const cortaPasado = (new Date(pasado.hasta) - Date.now()) / 86400000;
ok("una fecha pasada no encoge la ventana", cortaPasado > 8.9, String(cortaPasado));

// === Consultas que pueden no devolver nada ===================================
// `onError: continueRegularOutput` cubre los ERRORES, no las respuestas vacias.
// Un select de Supabase que no encuentra fila devuelve `[]`, el nodo no emite
// ningun item y TODA la rama de abajo deja de ejecutarse, sin error y sin log.
//
// Paso de verdad: un cliente sin modulo de correo reservaba bien y se quedaba
// sin respuesta, porque "Buscar modulo email" no devolvia fila y el nodo que
// contesta al webhook colgaba de el. La cita existia y al cliente se le decia
// que no se habia podido. Se vio al quitar la obligacion del email, que es lo
// que hizo normal no tener modulo de correo.

console.log("\n=== Consultas que pueden venir vacias ===");
for (const nombre of ["Buscar módulo email", "Buscar credenciales Google"]) {
  const n = wf.nodes.find((x) => x.name === nombre);
  ok(`"${nombre}" emite item aunque no encuentre nada`,
     n && n.alwaysOutputData === true,
     "alwaysOutputData: " + (n ? String(n.alwaysOutputData) : "no existe el nodo"));
}

// === El bot de WhatsApp ======================================================
// `Decidir accion` es el nodo que decide si se le crea una cita a alguien. Un
// fallo aqui no da error: da citas que nadie pidio, o silencio donde tenia que
// haber una reserva.

console.log("\n=== El bot: Decidir accion ===");

const bot = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n", "workflows", "whatsapp-bot.json"), "utf8"));
function nodoBot(nombre) {
  const n = bot.nodes.find((x) => x.name === nombre);
  if (!n) throw new Error("no existe el nodo " + nombre + " en whatsapp-bot.json");
  return n.parameters.jsCode;
}

// `ultimaDelBot` es lo último que contestó el bot en esa conversación. Sin
// ella, el nodo 'Cargar historial' no existe y el código tiene que sobrevivir.
function decidir(ia, mensaje, tieneAgenda, ultimaDelBot) {
  const entradas = {
    "Preparar búsqueda": { tiene_agenda: tieneAgenda !== false },
    "Extraer mensaje": { message_text: mensaje },
  };
  if (ultimaDelBot) entradas["Cargar historial"] = { role: "assistant", content: ultimaDelBot };
  return ejecutar(nodoBot("Decidir acción"), entradas, ia)[0].json;
}

const PREGUNTA_ANULAR = "¿Seguro que quieres anular tu cita del miércoles 30-09-2026 a las 17:00 con Javier?";

const PIDE = {
  reply: "", date: "2026-09-18", time: "17:00",
  servicio: "Mechas medio casco", trabajador: "Ana", confirmar: true, escalar: false,
};

let d = decidir(PIDE, "el viernes a las 5 con Ana me va bien");
ok("pedir la cita reserva", d.accion === "reservar", d.accion);
ok("y sin email, que ya no hace falta", !d.email, JSON.stringify(d.email));
ok("el servicio viaja", d.servicio === "Mechas medio casco", d.servicio);
ok("y la trabajadora tambien", d.trabajador === "Ana", d.trabajador);

d = decidir(Object.assign({}, PIDE, { confirmar: false }), "tienes hueco el viernes a las 5?");
ok("solo preguntar NO reserva", d.accion === "comprobar", d.accion);

d = decidir(Object.assign({}, PIDE, { confirmar: undefined }), "el viernes a las 5");
ok("sin `confirmar` tampoco reserva (ante la duda, se pregunta)", d.accion === "comprobar", d.accion);

d = decidir(Object.assign({}, PIDE, { servicio: null, trabajador: null }), "dame cita el viernes a las 5");
ok("sin servicio se manda igual: lo para el motor, no el bot", d.accion === "reservar", d.accion);
ok("y el servicio va vacio, no con un null pegado", d.servicio === "", JSON.stringify(d.servicio));

d = decidir(PIDE, "pues a las 17:30 mejor");
ok("la hora que escribe la persona manda sobre la que extrae la IA", d.hora === "17:30", d.hora);

d = decidir(PIDE, "el viernes a las 5", false);
ok("un cliente sin agenda no reserva nada", d.accion === "ninguna", d.accion);

// Un "no" es un no, aunque la IA diga que si. Paso en una demo: a "¿te la
// reservo?" contesto "No hace falta" y la cita se creo igual.
const CONFIRMA = Object.assign({}, PIDE, {
  reply: "¡Listo! Tu cita queda confirmada para el lunes 28-09-2026 a las 17:00 con Javier.",
});

for (const no of ["No hace falta", "no", "Déjalo", "mejor no", "no, gracias", "ya no", "Olvídalo"]) {
  d = decidir(CONFIRMA, no);
  ok('"' + no + '" no reserva', d.accion === "ninguna", d.accion);
}

d = decidir(CONFIRMA, "No hace falta");
ok(
  "y la confirmacion que ya habia escrito la IA no sale",
  !/confirmada/i.test(d.reply),
  d.reply
);

// El peligro contrario: una frase que empieza por "no" y SI es una reserva.
for (const si of [
  "no me va bien el lunes, reservame el martes a las 5",
  "no tengo prisa pero si, resérvamela",
  "no hace falta que sea con Ana, me vale cualquiera",
]) {
  d = decidir(PIDE, si);
  ok('"' + si + '" si reserva', d.accion === "reservar", d.accion);
}

d = decidir(Object.assign({}, PIDE, { confirmar: false }), "no hace falta");
ok("y tras un no tampoco se vuelve a ofrecer el hueco", d.accion === "ninguna", d.accion);

// Cambiar una cita: la otra mitad del mismo fallo. Antes esto reservaba una
// segunda cita y dejaba la primera en pie.
d = decidir(Object.assign({}, PIDE, { cambiar_cita: true, confirmar: false }),
  "no me va bien el viernes, me la cambias al martes?");
ok("cambiar una cita no reserva: mueve", d.accion === "mover", d.accion);
ok("y no se da por hecho hasta que dice que si", d.confirmar === false, JSON.stringify(d.confirmar));

d = decidir(Object.assign({}, PIDE, { cambiar_cita: true, confirmar: true }), "si, cambiamela a esa hora");
ok("cuando dice que si, se mueve de verdad", d.accion === "mover" && d.confirmar === true, d.accion);

d = decidir(Object.assign({}, PIDE, { cambiar_cita: true, date: null, time: null }), "quiero cambiar mi cita");
ok("sin dia ni hora sigue siendo mover: ya preguntara el motor", d.accion === "mover", d.accion);

d = decidir(Object.assign({}, PIDE, { cambiar_cita: true }), "no hace falta");
ok("y un no tambien para el cambio", d.accion === "ninguna", d.accion);

d = decidir(Object.assign({}, PIDE, { cambiar_cita: true }), "cambiamela al martes", false);
ok("un cliente sin agenda tampoco mueve nada", d.accion === "ninguna", d.accion);

d = decidir(Object.assign({}, PIDE, { anular_cita: true, confirmar: false, date: null, time: null }), "no voy a poder ir, anulamela");
ok("anular pide anular, sin dia ni hora", d.accion === "anular" && d.confirmar === false, d.accion);

d = decidir(Object.assign({}, PIDE, { anular_cita: true, confirmar: true }), "si, anulala", true, PREGUNTA_ANULAR);
ok("y cuando confirma a la pregunta, se anula de verdad", d.accion === "anular" && d.confirmar === true, d.accion);

// Lo que pasó en la demo (29/09/2026): la IA marcó confirmar=true a la primera
// y la cita se anuló sin preguntar.
d = decidir(Object.assign({}, PIDE, { anular_cita: true, confirmar: true, date: null, time: null }),
  "no voy a poder ir", true, "¡Listo! Tu cita queda confirmada para el miércoles 30-09-2026 a las 17:00 con Javier.");
ok("«no voy a poder ir» a la primera NO anula: pregunta antes, diga lo que diga la IA",
  d.accion === "anular" && d.confirmar === false, JSON.stringify([d.accion, d.confirmar]));

d = decidir(Object.assign({}, PIDE, { anular_cita: true, confirmar: true }), "anulala");
ok("ni sin historial, que es una conversacion nueva", d.confirmar === false, JSON.stringify(d.confirmar));

// Y mover no se toca: «cámbiamela al jueves a las 11» es una orden, como
// «resérvame el jueves», y una cita movida se puede volver a mover.
d = decidir(Object.assign({}, PIDE, { cambiar_cita: true, confirmar: true }), "cambiamela al jueves a las 11");
ok("mover sigue sin necesitar la pregunta si la orden es clara", d.accion === "mover" && d.confirmar === true, JSON.stringify(d.confirmar));

d = decidir(Object.assign({}, PIDE, { anular_cita: true, confirmar: true }), "no");
ok("a «¿seguro que quieres anularla?» un no la deja como estaba", d.accion === "ninguna", d.accion);

d = decidir(Object.assign({}, PIDE, { anular_cita: true, cambiar_cita: true }), "anula la del martes y dame el jueves a las 5");
ok("si pide las dos cosas, gana mover: es un cambio", d.accion === "mover", d.accion);

console.log("\n=== El bot: Preparar contexto ===");
// Por este nodo pasa CADA mensaje que recibe el bot, tenga agenda o no. Si
// revienta, el cliente deja de contestar del todo.

function prepararContexto(agendaApi, tieneAgenda) {
  return ejecutar(nodoBot("Preparar contexto"), {
    "Buscar prompt del cliente": { system_prompt: "Eres la recepcion.", knowledge_base: "" },
    "Preparar búsqueda": { tiene_agenda: tieneAgenda !== false },
    "Recoger conocimiento": { fragmentos: [] },
    "Recoger productos": { productos: [] },
    "Consultar agenda": agendaApi,
    "Extraer mensaje": { message_text: "hola, queria unas mechas", adjunto: null },
  }, {})[0].json;
}

const CATALOGO = [
  { nombre: "Corte", duracion_min: 45 },
  { nombre: "Mechas medio casco", duracion_min: 150 },
];

let ctxIA = prepararContexto({
  dias: [{ dia: "viernes", fecha: "2026-09-11", horas: ["10:00", "10:15"] }],
  duracion_min: 150, paso_min: 15,
  catalogo: CATALOGO,
  servicios: [{ nombre: "Mechas medio casco", duracion_min: 150 }],
});
let texto = ctxIA.messages.map((x) => x.content).join("\n");
ok("arma los mensajes para el modelo", ctxIA.messages.length > 3, String(ctxIA.messages.length));
ok("le da el catalogo real del negocio", /Mechas medio casco \(150 min\)/.test(texto), "no aparece el catalogo");
ok("dice que se ha entendido el servicio", /se ha entendido: Mechas medio casco/.test(texto));
ok("y la cabecera de huecos es la de ese servicio", /HUECOS LIBRES PARA Mechas medio casco/.test(texto));
ok("pide servicio y trabajador en el JSON", /"servicio"/.test(texto) && /"trabajador"/.test(texto));
ok("ya no dice que el email haga falta para reservar", !/hacen falta TRES datos: fecha, hora y email/.test(texto));

ctxIA = prepararContexto({
  dias: [], duracion_min: 60, paso_min: 15,
  catalogo: CATALOGO, servicios: [],
});
texto = ctxIA.messages.map((x) => x.content).join("\n");
ok("sin servicio entendido, avisa de que los huecos son de una cita estandar",
   /cita estandar de 60 min/.test(texto) && /preguntale primero que se va a hacer/.test(texto));

// Una tienda sin agenda no debe recibir ni una palabra de citas.
ctxIA = prepararContexto({}, false);
texto = ctxIA.messages.map((x) => x.content).join("\n");
ok("una tienda sin agenda no ve nada de agenda",
   !/HUECOS LIBRES/.test(texto) && !/SERVICIOS QUE SE PUEDEN RESERVAR/.test(texto));

// Un negocio con agenda pero sin servicios definidos (el caso de siempre).
ctxIA = prepararContexto({
  dias: [{ dia: "viernes", fecha: "2026-09-11", horas: ["10:00"] }],
  duracion_min: 60, paso_min: 15, catalogo: [], servicios: [],
});
texto = ctxIA.messages.map((x) => x.content).join("\n");
ok("sin servicios definidos no se inventa una lista vacia", !/SERVICIOS QUE SE PUEDEN RESERVAR/.test(texto));
ok("pero sigue dando los huecos", /HUECOS LIBRES/.test(texto));

console.log("\n=== El bot: Respuesta con agenda ===");
let rb = ejecutar(nodoBot("Respuesta con agenda"), {}, {
  mensaje: "El viernes 18-09-2026 a las 17:00 con Ana está libre.",
  libre: true, reservada: false,
})[0].json;
ok("si solo preguntaba, se le ofrece reservar", /¿Te la reservo\?$/.test(rb.reply), rb.reply);
ok("y no se le pide el correo", !/correo|email/i.test(rb.reply), rb.reply);

rb = ejecutar(nodoBot("Respuesta con agenda"), {}, {
  mensaje: "¡Listo! Tu cita queda confirmada para el viernes.",
  libre: true, reservada: true,
})[0].json;
ok("una cita ya hecha no pregunta nada", !/reservo/.test(rb.reply), rb.reply);

// === Inmuebles ===============================================================
// La cartera de una inmobiliaria (migracion 0025). `inmuebles-ejemplo.json` es
// la salida REAL de `inmuebles_cartera` y `buscar_inmuebles` con la cartera de
// la demo: si cambia la funcion, esto tiene que fallar.

console.log("\n=== El bot: inmuebles ===");

const INM = JSON.parse(fs.readFileSync(path.join(__dirname, "inmuebles-ejemplo.json"), "utf8"));

ok("Preparar busqueda marca el modulo de inmuebles",
  ejecutar(nodoBot("Preparar búsqueda"), { "Extraer mensaje": { message_text: "hola" } }, { module: "inmuebles" })[0].json.tiene_inmuebles === true);
ok("y no se lo marca a quien no lo tiene",
  ejecutar(nodoBot("Preparar búsqueda"), { "Extraer mensaje": { message_text: "hola" } }, { module: "calendar" })[0].json.tiene_inmuebles === false);

function contextoInmuebles(tieneInmuebles, cartera) {
  return ejecutar(nodoBot("Preparar contexto"), {
    "Buscar prompt del cliente": { system_prompt: "Eres la inmobiliaria.", knowledge_base: "" },
    "Preparar búsqueda": { tiene_agenda: false, tiene_inmuebles: tieneInmuebles },
    "Recoger conocimiento": { fragmentos: [] },
    "Recoger productos": { productos: [] },
    "Cartera de inmuebles": cartera,
    "Extraer mensaje": { message_text: "busco piso", adjunto: null },
  }, {})[0].json.messages.map((x) => x.content).join("\n");
}

texto = contextoInmuebles(true, INM.cartera);
ok("le da a la IA la cartera que existe", /CARTERA DE INMUEBLES/.test(texto) && /Sant Josep/.test(texto) && /casa de pueblo/.test(texto));
ok("con los precios en formato de aqui", /de 68\.000 a 560\.000 €/.test(texto) && /de 300 a 1\.500 €\/mes/.test(texto), (texto.match(/Disponibles ahora:.*$/m) || [""])[0]);
ok("y le pide el campo inmuebles del JSON", /"inmuebles"/.test(texto) && /"precio_max"/.test(texto));
ok("le prohibe escribir la lista ella", /NUNCA escribas tu inmuebles, precios ni referencias/.test(texto));
ok("le separa los tipos de vivienda de los de negocio (pisos incluidos)",
  /Tipos de vivienda: .*piso/.test(texto) && /Tipos para negocio o suelo: local, nave, oficina, parcela/.test(texto) && !/Tipos de vivienda: .*local/.test(texto),
  (texto.match(/Tipos de vivienda:.*$/m) || [""])[0]);
ok("sin el modulo no ve nada de inmuebles", !/CARTERA DE INMUEBLES|"inmuebles"/.test(contextoInmuebles(false)));
ok("con el modulo pero la cartera vacia, tampoco", !/CARTERA DE INMUEBLES/.test(contextoInmuebles(true, { total: 0 })));
ok("y si la consulta de la cartera fallo, sigue sin reventar", !/CARTERA DE INMUEBLES/.test(contextoInmuebles(true, { error: "500" })));

function decidirInmuebles(inmuebles, extra, tieneInmuebles) {
  return ejecutar(nodoBot("Decidir acción"), {
    "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: tieneInmuebles !== false },
    "Extraer mensaje": { message_text: (extra && extra.mensaje) || "busco piso para comprar en ontinyent" },
  }, Object.assign({ reply: "", date: null, time: null, confirmar: false, escalar: false, inmuebles }, extra || {}))[0].json;
}

d = decidirInmuebles({ operacion: "compra", tipos: "piso", precio_max: "150.000", habitaciones_min: 3 });
ok("limpia los criterios: compra -> venta, cadena -> lista, «150.000» -> 150000",
  d.inmuebles && d.inmuebles.operacion === "venta" && d.inmuebles.tipos[0] === "piso" && d.inmuebles.precio_max === 150000 && d.inmuebles.habitaciones_min === 3,
  JSON.stringify(d.inmuebles));
ok("«hasta 150» en una compra son 150.000", decidirInmuebles({ operacion: "venta", precio_max: 150 }).inmuebles.precio_max === 150000);
ok("«150 mil» tambien", decidirInmuebles({ operacion: "venta", precio_max: "150 mil" }).inmuebles.precio_max === 150000);
ok("un alquiler de 150.000 al mes se queda sin tope", decidirInmuebles({ operacion: "alquiler", precio_max: 150000 }).inmuebles.precio_max === null);
ok("la IA sin busqueda no busca", decidirInmuebles(null).inmuebles === null);
ok("quien no tiene el modulo no busca nunca", decidirInmuebles({ operacion: "venta" }, {}, false).inmuebles === null);
d = decidirInmuebles({ operacion: "venta", refs: ["104"] }, { date: "2026-10-08", time: "17:00", confirmar: true, mensaje: "quiero ver el 104 el jueves a las 5" });
ok("si pide visita, manda la agenda y no se busca", d.accion === "reservar" && d.inmuebles === null, JSON.stringify([d.accion, d.inmuebles]));

const FICHAS_YA_ENVIADAS = "Tengo 2 que encajan:\n\n*Ref. 101* · Piso en Sant Josep (Ontinyent)\n98.000 €\n\n*Ref. 102* · Piso en Sant Josep (Ontinyent)\n118.000 €";
d = ejecutar(nodoBot("Decidir acción"), {
  "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
  "Extraer mensaje": { message_text: "me has dado las mismas, no tienes nada mas?" },
  "Cargar historial": { role: "assistant", content: FICHAS_YA_ENVIADAS },
}, { reply: "", inmuebles: { operacion: "venta", zonas: ["Sant Josep"] } })[0].json;
ok("lo ya ensenado en la conversacion se manda para excluir", JSON.stringify(d.inmuebles.excluir_refs) === '["101","102"]', JSON.stringify(d.inmuebles.excluir_refs));
d = ejecutar(nodoBot("Decidir acción"), {
  "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
  "Extraer mensaje": { message_text: "y el 101 tiene trastero?" },
  "Cargar historial": { role: "assistant", content: FICHAS_YA_ENVIADAS },
}, { reply: "", inmuebles: { refs: ["101"] } })[0].json;
ok("pero al preguntar por una referencia no se excluye nada", d.inmuebles.excluir_refs === undefined, JSON.stringify(d.inmuebles));
ok("y sin historial no revienta", decidirInmuebles({ operacion: "venta" }).inmuebles.excluir_refs.length === 0);

// «¿Te los enseño?» -> «si»: en la prueba del 06/10 la IA dejo la zona puesta
// tres veces seguidas y el bot repetia la misma oferta en bucle.
const OFERTA = "En Sant Josep no tengo más aparte de los que ya te he enseñado.\n\nEn otras zonas de Ontinyent tengo 3 más con lo que buscas. ¿Te los enseño?";
function trasLaOferta(mensaje, ultimaDelBot) {
  return ejecutar(nodoBot("Decidir acción"), {
    "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
    "Extraer mensaje": { message_text: mensaje },
    "Cargar historial": { role: "assistant", content: ultimaDelBot || OFERTA },
  }, { reply: "", inmuebles: { operacion: "venta", municipios: ["Ontinyent"], zonas: ["Sant Josep"], precio_max: 150000 } })[0].json.inmuebles;
}
for (const si of ["si, enseñamelos", "Sí", "vale", "venga, a ver", "claro", "enséñamelos", "Me has dado las mismas opciones, no tienes nada más?", "y otras?"]) {
  const f = trasLaOferta(si);
  ok("tras la oferta, «" + si + "» busca sin la zona y con lo demas", f.zonas.length === 0 && f.municipios[0] === "Ontinyent" && f.precio_max === 150000, JSON.stringify(f));
}
ok("tras la oferta, cambiar de criterio no quita la zona", trasLaOferta("prefiero con garaje").zonas[0] === "Sant Josep");
ok("sin oferta delante, un «si» no quita la zona", trasLaOferta("si", "¿Te gustaría ver alguno? Dime la referencia.").zonas[0] === "Sant Josep");

// Las otras dos ofertas (07/10/2026).
let f2 = trasLaOferta("si", "No tengo casas de campo en venta en El Llombo hasta 180.000 €.\n\nFuera de Ontinyent tengo uno en Agullent con lo que buscas. ¿Te lo enseño?");
ok("«fuera de Ontinyent... ¿te lo enseño?» -> «si»: sin municipio ni zona, con el precio",
  f2.municipios.length === 0 && f2.zonas.length === 0 && f2.precio_max === 150000, JSON.stringify(f2));
f2 = trasLaOferta("vale", "No tengo chalets en venta en Ontinyent hasta 180.000 €.\n\nCon lo demás que buscas tengo 4, pero el más económico está en 240.000 €. ¿Te los enseño?");
ok("«el mas economico esta en 240.000... ¿te los enseño?» -> «vale»: el tope un tercio mas alto (150.000 -> 200.000), con la zona",
  f2.precio_max === 200000 && f2.tope_ampliado === true && f2.zonas[0] === "Sant Josep", JSON.stringify(f2));
f2 = trasLaOferta("vale", "No tengo chalets en alquiler hasta 1.000 €/mes.\n\nCon lo demás que buscas tengo uno, pero está en 1.300 €/mes. ¿Te lo enseño?");
ok("lo mismo con uno solo («pero está en 1.300 €/mes»)", f2.precio_max === 200000 && f2.tope_ampliado === true, JSON.stringify(f2));
// En alquiler se redondea a decenas, no a miles.
f2 = ejecutar(nodoBot("Decidir acción"), {
  "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
  "Extraer mensaje": { message_text: "vale" },
  "Cargar historial": { role: "assistant", content: "No tengo chalets en alquiler hasta 1.000 €/mes.\n\nCon lo demás que buscas tengo uno, pero está en 1.300 €/mes. ¿Te lo enseño?" },
}, { reply: "", inmuebles: { operacion: "alquiler", tipos: ["chalet"], precio_max: 1000 } })[0].json.inmuebles;
ok("alquiler de 1.000 aceptando la oferta: hasta 1.340 €/mes", f2.precio_max === 1340, JSON.stringify(f2));

// «Busco una vivienda en Sant Josep» llego sin tipos y salio un local (07/10/2026).
function tiposTras(mensaje, tipos, historial) {
  const entradas = {
    "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
    "Extraer mensaje": { message_text: mensaje },
  };
  if (historial) entradas["Cargar historial"] = historial;
  return ejecutar(nodoBot("Decidir acción"), entradas, { reply: "", inmuebles: { operacion: "venta", tipos } })[0].json.inmuebles.tipos;
}
const VIVIENDAS = '["piso","ático","casa de pueblo","adosado","chalet","casa de campo"]';
ok("«busco una vivienda» sin tipos: solo viviendas, nunca locales", JSON.stringify(tiposTras("Busco una vivienda en la zona de San Jose para comprar", [])) === VIVIENDAS);
ok("lo mismo si lo dijo antes («y en Sant Antoni?» tras pedir casa)",
  JSON.stringify(tiposTras("y en Sant Antoni?", [], { role: "user", content: "busco casa para comprar" })) === VIVIENDAS);
ok("sin hablar de vivir, sin tipos se queda sin tipos", tiposTras("que teneis en venta en Ontinyent?", []).length === 0);
ok("y si la IA ya puso tipo, no se toca", JSON.stringify(tiposTras("busco local, que es para mi negocio no para vivienda", ["local"])) === '["local"]');

// Un «municipio» que no es un pueblo de la cartera se trata como zona (07/10/2026).
function lugaresTras(municipios, zonas) {
  const f = ejecutar(nodoBot("Decidir acción"), {
    "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
    "Extraer mensaje": { message_text: "y en sant antoni?" },
    "Cartera de inmuebles": INM.cartera,
  }, { reply: "", inmuebles: { operacion: "venta", tipos: ["piso"], municipios, zonas } })[0].json.inmuebles;
  return JSON.stringify({ municipios: f.municipios, zonas: f.zonas });
}
ok("«Sant Antoni» como municipio pasa a zona", lugaresTras(["Sant Antoni"], []) === '{"municipios":[],"zonas":["Sant Antoni"]}', lugaresTras(["Sant Antoni"], []));
ok("Valencia tambien (no es de la cartera)", lugaresTras(["Valencia"], []) === '{"municipios":[],"zonas":["Valencia"]}', lugaresTras(["Valencia"], []));
ok("los pueblos de la cartera se quedan, con o sin tilde ni «L'»",
  lugaresTras(["Ontinyent", "olleria", "Xativa"], []) === '{"municipios":["Ontinyent","olleria","Xativa"],"zonas":[]}', lugaresTras(["Ontinyent", "olleria", "Xativa"], []));
ok("sin cartera a mano, no se toca nada", JSON.stringify(ejecutar(nodoBot("Decidir acción"), {
  "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
  "Extraer mensaje": { message_text: "y en sant antoni?" },
}, { reply: "", inmuebles: { operacion: "venta", municipios: ["Sant Antoni"] } })[0].json.inmuebles.municipios) === '["Sant Antoni"]');

// Aceptar una oferta rehace la busqueda ANTERIOR (0028), no la que escriba la IA.
const CHALETS_180K = { operacion: "venta", tipos: ["chalet"], municipios: ["Ontinyent"], precio_max: 180000 };
const OFERTA_CHALETS = "No tengo chalets en venta en Ontinyent hasta 180.000 €.\n\nCon lo demás que buscas tengo 4, pero el más económico está en 240.000 €. ¿Te los enseño?";
function aceptar(mensaje, iaInmuebles, ultima) {
  const entradas = {
    "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
    "Extraer mensaje": { message_text: mensaje },
    "Cargar historial": { role: "assistant", content: OFERTA_CHALETS },
  };
  if (ultima !== undefined) entradas["Última búsqueda"] = ultima;
  return ejecutar(nodoBot("Decidir acción"), entradas, { reply: "", inmuebles: iaInmuebles })[0].json.inmuebles;
}
const RECIENTE = new Date().toISOString();
let fa = aceptar("vale, enseñamelos", { operacion: "venta", tipos: ["piso", "ático", "chalet"], municipios: ["Ontinyent"] }, { filtros: CHALETS_180K, updated_at: RECIENTE });
ok("«vale, enseñamelos» tras la oferta de chalets: chalets hasta un tercio mas (240.000), aunque la IA cambiara los tipos",
  JSON.stringify(fa.tipos) === '["chalet"]' && fa.precio_max === 240000 && fa.tope_ampliado === true && fa.municipios[0] === "Ontinyent", JSON.stringify(fa));
fa = aceptar("si", null, { filtros: CHALETS_180K, updated_at: RECIENTE });
ok("«si» sin que la IA rellene la busqueda: se busca igual", fa && JSON.stringify(fa.tipos) === '["chalet"]' && fa.precio_max === 240000, JSON.stringify(fa));
fa = aceptar("si", { operacion: "venta", tipos: ["chalet"], precio_max: 180000 }, {});
ok("sin busqueda guardada, se afloja lo que puso la IA (como antes)", fa.precio_max === 240000, JSON.stringify(fa));
fa = aceptar("si", { operacion: "venta", tipos: ["chalet"], precio_max: 180000 }, { filtros: { operacion: "alquiler", tipos: ["piso"] }, updated_at: new Date(Date.now() - 3 * 86400000).toISOString() });
ok("una busqueda guardada de hace dias no cuenta como «la anterior»", fa.operacion === "venta" && fa.precio_max === 240000, JSON.stringify(fa));
fa = aceptar("prefiero en alquiler", { operacion: "alquiler", tipos: ["chalet"] }, { filtros: CHALETS_180K, updated_at: RECIENTE });
ok("cambiar de criterio no es aceptar: manda lo nuevo de la IA", fa.operacion === "alquiler", JSON.stringify(fa));

// Lo enseñado caduca: «hola, empiezo de nuevo» al dia siguiente (07/10/2026).
d = ejecutar(nodoBot("Decidir acción"), {
  "Preparar búsqueda": { tiene_agenda: true, tiene_inmuebles: true },
  "Extraer mensaje": { message_text: "busco vivienda en san jose para comprar" },
  "Cargar historial": { role: "assistant", content: FICHAS_YA_ENVIADAS, created_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString() },
}, { reply: "", inmuebles: { operacion: "venta", zonas: ["Sant Josep"] } })[0].json;
ok("lo ensenado ayer no cuenta como ya visto", d.inmuebles.excluir_refs.length === 0, JSON.stringify(d.inmuebles.excluir_refs));

// `buscar_inmuebles` devuelve un solo objeto (0026); si la llamada falla, llega
// el item de error que deja pasar `continueRegularOutput`.
function respuestaInmuebles(caso, reply, resultadoOverride) {
  const b = INM.busquedas[caso] || { filtros: {}, resultado: { filas: [] } };
  const items = [{ json: resultadoOverride || b.resultado }];
  const $ = (nombre) => {
    if (nombre !== "Decidir acción") throw new Error("Referenced node is unexecuted: " + nombre);
    return { first: () => ({ json: { reply: reply || "", inmuebles: b.filtros } }) };
  };
  const fn = new Function("$", "$input", nodoBot("Respuesta con inmuebles"));
  return fn($, { all: () => items, first: () => items[0] })[0].json;
}

let ri = respuestaInmuebles("piso_3hab_150k_ontinyent");
console.log("\n  --- lo que leeria quien busca ---\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("dice cuantos encajan", /^Tengo 2 que encajan con lo que buscas:/.test(ri.reply), ri.reply.split("\n")[0]);
ok("en el orden de la base: 105, 102 y luego el 104",
  ri.reply.indexOf("*Ref. 105*") < ri.reply.indexOf("*Ref. 102*") && ri.reply.indexOf("*Ref. 102*") < ri.reply.indexOf("*Ref. 104*"));
ok("cada precio sale tal cual de la base, con punto de millar",
  INM.busquedas.piso_3hab_150k_ontinyent.resultado.filas.every((f) => ri.reply.includes(String(f.precio).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €")));
ok("el que se pasa lo dice, y cuanto", /Y este se acerca/.test(ri.reply) && /Se pasa 2\.000 € de lo que me dijiste/.test(ri.reply));
ok("y cierra ofreciendo la visita", /te busco hueco para la visita/.test(ri.reply));
ok("las referencias ensenadas viajan aparte", ri.inmuebles_mostrados.join(",") === "105,102,104", ri.inmuebles_mostrados.join(","));

ri = respuestaInmuebles("piso_sant_josep_130k");
ok("otra zona no rellena la lista: se ofrece", !/\*Ref\. 105\*/.test(ri.reply) &&
  /Es todo lo que tengo en Sant Josep\. En otras zonas de Ontinyent tengo uno más con lo que buscas\. ¿Te lo enseño\?/.test(ri.reply), ri.reply);

// La primera prueba real (06/10/2026), mensaje a mensaje. Antes: las mismas tres
// fichas tres veces, una de ellas de La Vila, que nadie habia pedido.
console.log("\n  --- la conversacion del 06/10, ahora ---");
ri = respuestaInmuebles("sant_josep_vivienda");
console.log("  «vivienda en San José, comprar»\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("1. salen las dos de Sant Josep y nada de La Vila", /\*Ref\. 101\*/.test(ri.reply) && /\*Ref\. 102\*/.test(ri.reply) && !/\*Ref\. 112\*/.test(ri.reply));
ok("   y ofrece las 12 de otras zonas en vez de colarlas", /En otras zonas de Ontinyent tengo 12 más con lo que buscas\. ¿Te los enseño\?/.test(ri.reply), ri.reply.split("\n\n").slice(-1)[0]);
ri = respuestaInmuebles("sant_josep_150k_ya_vistos");
console.log("  «tengo 150.000, ¿algo mejor?»\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("2. con 150.000: no repite, dice que en Sant Josep no hay mas y ofrece las 3 de fuera",
  !/\*Ref\./.test(ri.reply) && /^En Sant Josep no tengo más aparte de los que ya te he enseñado\./.test(ri.reply) &&
  /En otras zonas de Ontinyent tengo 3 más con lo que buscas\. ¿Te los enseño\?/.test(ri.reply), ri.reply);
ri = respuestaInmuebles("ontinyent_150k_ya_vistos");
console.log("  «sí, enséñamelos»\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("3. «si»: las de otras zonas, diciendo que son aparte de las ya vistas",
  /^Aparte de los que ya te he enseñado, tengo 3 más que encajan:/.test(ri.reply) && /\*Ref\. 103\*/.test(ri.reply), ri.reply.split("\n")[0]);
ri = respuestaInmuebles("ontinyent_150k_todo_visto");
console.log("  «¿no tienes nada más?»\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("4. visto todo lo que cumple: lo dice, y ensena solo la que se pasa un poco, avisando",
  /^Aparte de los que ya te he enseñado, justo con todo lo que pides no tengo más, pero esto se acerca:/.test(ri.reply) && /Se pasa/.test(ri.reply), ri.reply.split("\n")[0]);

ri = respuestaInmuebles("piso_venta_sin_mas");
ok("con muchos, ensena 3 y dice cuantos hay", /^Tengo \d+ que encajan con lo que buscas; te pongo los 3 que más se ajustan:/.test(ri.reply), ri.reply.split("\n")[0]);
ok("y pide lo que falta para afinar", /Si me dices la zona y hasta cuánto quieres gastar, te lo afino más/.test(ri.reply), ri.reply.split("\n\n").slice(-1)[0]);

ri = respuestaInmuebles("local_sin_operacion");
ok("sin decir compra o alquiler, cada ficha lo dice", /Local en alquiler/.test(ri.reply) && /€\/mes/.test(ri.reply));
ok("y en un local no pregunta habitaciones sino metros", /comprar o alquilar y la zona/.test(ri.reply) && !/habitaciones necesitas/.test(ri.reply), ri.reply.split("\n\n").slice(-1)[0]);

ri = respuestaInmuebles("chalet_alquiler_1000");
ok("sin nada que encaje, dice que es lo que ha buscado", /^No tengo chalets en alquiler hasta 1\.000 €\/mes\./.test(ri.reply), ri.reply);
ok("y lo mas cercano que si hay, con su precio", /Con lo demás que buscas tengo uno, pero está en 1\.300 €\/mes\. ¿Te lo enseño\?/.test(ri.reply), ri.reply);
ok("y no escala: sigue la conversacion", ri.escalar === false);
ri = respuestaInmuebles("chalet_alquiler_1000", "", { filas: [], total_exactos: 0, vistos: 0, otras_zonas: 0, otros_municipios: 0, municipios_fuera: [], mas_caros: 0, mas_caros_desde: null });
ok("sin nada ni parecido, ofrece aflojar o avisar", /aflojamos algo/.test(ri.reply) && /para que te avise/.test(ri.reply), ri.reply);

// La segunda prueba real (07/10/2026), con 180.000 € para comprar.
console.log("\n  --- la conversacion del 07/10, ahora ---");
ri = respuestaInmuebles("casa_de_campo_llombo_180k");
console.log("  «¿y en casa de campo por ese importe?» (con El Llombo arrastrado)\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("casa de campo: dice que ha buscado casas de campo, no «nada en El Llombo»",
  /^No tengo casas de campo en venta en El Llombo hasta 180\.000 €\./.test(ri.reply), ri.reply);
ok("y ofrece la de Agullent", /Fuera de Ontinyent tengo uno en Agullent que se acerca a lo que buscas\. ¿Te lo enseño\?/.test(ri.reply), ri.reply);
ri = respuestaInmuebles("chalet_ontinyent_180k");
console.log("  «¿algún chalet por 180.000?»\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("chalet por 180.000: no hay, y el mas economico esta en 240.000",
  /^No tengo chalets en venta en Ontinyent hasta 180\.000 €\./.test(ri.reply) &&
  /Con lo demás que buscas tengo uno, pero está en 240\.000 €\. ¿Te lo enseño\?/.test(ri.reply), ri.reply);

// La tercera prueba real (15/10/2026): con 200.000, «sí» enseñaba tambien el
// de 435.000 y, bajando a 250.000, ofrecia el de 560.000.
ri = respuestaInmuebles("chalet_ontinyent_200k");
ok("chalets por 200.000: ofrece los 2 que no pasan de un tercio, desde 240.000",
  /Con lo demás que buscas tengo 2, pero el más económico está en 240\.000 €\. ¿Te los enseño\?/.test(ri.reply), ri.reply);
const aceptada = trasLaOferta("si", ri.reply);
ok("y «si» la acepta con el tope ampliado", aceptada.tope_ampliado === true && aceptada.precio_max === 200000, JSON.stringify(aceptada));
ri = respuestaInmuebles("chalet_ontinyent_200k_aceptado");
ok("al aceptar: el de 240.000 y el de 265.000, por ese orden, sin el de 435.000",
  /\*Ref\. 115\*/.test(ri.reply) && /\*Ref\. 117\*/.test(ri.reply) && !/\*Ref\. 118\*/.test(ri.reply) && ri.reply.indexOf("Ref. 115") < ri.reply.indexOf("Ref. 117"), ri.reply);
ri = respuestaInmuebles("chalet_ontinyent_250k_ya_vistos");
console.log("  «máximo 250.000» tras verlos\n  " + ri.reply.split("\n").join("\n  ") + "\n");
ok("«máximo 250.000» tras verlos: no hay mas, y no ofrece el de 560.000", !/560\.000|¿Te los? enseño\?/.test(ri.reply), ri.reply);
ri = respuestaInmuebles("casa_de_campo_fuera_180k");
ok("y al aceptar Agullent: la ensena avisando de que se pasa", /\*Ref\. 120\*/.test(ri.reply) && /Se pasa 15\.000 €/.test(ri.reply), ri.reply);

ri = respuestaInmuebles("ref_116_reservado");
ok("una referencia reservada: lo dice y no la ofrece", /El 116 .* está reservado/.test(ri.reply) && !/\*Ref\. 116\*/.test(ri.reply) && !/hueco para la visita/.test(ri.reply), ri.reply);

ri = respuestaInmuebles("ref_104_y_999");
ok("referencia que existe: su ficha, con la operacion", /\*Ref\. 104\* · Piso en venta en el centro de Ontinyent/.test(ri.reply), ri.reply.split("\n")[0]);
ok("referencia que no existe: lo dice", /No tengo ninguna referencia 999/.test(ri.reply), ri.reply);

ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "Sí, en todos se admiten mascotas.");
ok("lo que contesta la IA a otra cosa va delante", /^Sí, en todos se admiten mascotas\.\n\nTengo 2/.test(ri.reply), ri.reply.slice(0, 80));
ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "¡Claro! Mira lo que tengo:");
ok("una entradilla que acaba en dos puntos se quita (el «¡Claro!» se queda)", /^¡Claro!\n\nTengo 2/.test(ri.reply), ri.reply.slice(0, 60));
ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "Te recomiendo el de 129.000 €, que es una ganga.");
ok("si la IA escribe precios por su cuenta, se quita", /^Tengo 2/.test(ri.reply) && !/ganga/.test(ri.reply), ri.reply.slice(0, 60));

// Frases reales de gpt-4o en las pruebas del 06/10/2026, con reply vacio pedido.
ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "Gracias por escribirnos. Estoy buscando opciones para ti de inmediato.");
ok("de la entradilla se queda el agradecimiento y se va el «estoy buscando»", /^Gracias por escribirnos\.\n\nTengo 2/.test(ri.reply), ri.reply.slice(0, 80));
ri = respuestaInmuebles("local_sin_operacion", "¡Gracias por contactar! Necesito saber si tienes algún presupuesto en mente para poder mostrarte lo que mejor se adapte.");
ok("y la pregunta se va: el cierre del sistema ya pide lo que falta", /^¡Gracias por contactar!\n\nTengo/.test(ri.reply), ri.reply.slice(0, 80));
ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "Ahora mismo te busco opciones de pisos en Ontinyent con esas características.");
ok("si toda la entradilla es anunciar la busqueda, no queda nada", /^Tengo 2/.test(ri.reply), ri.reply.slice(0, 60));
ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "Ara mateix busque opcions per a tu a Ontinyent amb ascensor.");
ok("tambien en valenciano", /^Tengo 2/.test(ri.reply), ri.reply.slice(0, 60));
ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "Vamos a echar un vistazo en Sant Antoni entonces. Dame un momento mientras reviso la disponibilidad.");
ok("y «vamos a echar un vistazo…» (07/10/2026)", /^Tengo 2/.test(ri.reply), ri.reply.slice(0, 60));

ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "", { error: "500 Internal Server Error" });
ok("si la base falla, no improvisa: lo dice y avisa al equipo", /no puedo consultar la cartera/.test(ri.reply) && ri.escalar === true, ri.reply);

console.log("\n=== El bot: el camino de la busqueda ===");
const cx = bot.connections;
ok("la rama sin agenda pasa por ¿Buscar inmuebles?", cx["¿Consultar agenda?"].main[1][0].node === "¿Buscar inmuebles?");
ok("que si busca va a Buscar inmuebles y si no, a Respuesta sin agenda",
  cx["¿Buscar inmuebles?"].main[0][0].node === "Buscar inmuebles" && cx["¿Buscar inmuebles?"].main[1][0].node === "Respuesta sin agenda");
ok("y la respuesta acaba en Respuesta final, que pone la presentacion", cx["Respuesta con inmuebles"].main[0][0].node === "Respuesta final");
ok("la cartera y la ultima busqueda se leen antes de llamar a la IA",
  cx["Recoger productos"].main[0][0].node === "Cartera de inmuebles" &&
  cx["Cartera de inmuebles"].main[0][0].node === "Última búsqueda" &&
  cx["Última búsqueda"].main[0][0].node === "Consultar agenda");
ok("la busqueda se anota en paralelo, como hoja: no toca la respuesta",
  cx["¿Buscar inmuebles?"].main[0].some((c) => c.node === "Anotar búsqueda") && !cx["Anotar búsqueda"]);
for (const nombre of ["Cartera de inmuebles", "Última búsqueda", "Buscar inmuebles"]) {
  const n = bot.nodes.find((x) => x.name === nombre);
  ok(`"${nombre}" emite item aunque no encuentre nada o falle`,
    n.alwaysOutputData === true && n.onError === "continueRegularOutput");
}
ok('"Anotar búsqueda" no tumba nada si falla (p. ej. sin la migracion 0028)',
  bot.nodes.find((x) => x.name === "Anotar búsqueda").onError === "continueRegularOutput");

// === Busqueda con contexto (14/10/2026) =======================================
// A «¿cuales son las terminaciones?», en mitad de una conversacion de persianas,
// la busqueda no traia el documento de persianas porque solo miraba el ultimo
// mensaje, y la IA se invento los acabados. Ahora se busca tambien con lo que se
// dijo justo antes.

console.log("\n=== El bot: busqueda con contexto ===");

/** Como `ejecutar`, pero un nodo puede dar varios items (un array). */
function ejecutarItems(codigo, entradas, itemsEntrada) {
  const $ = (nombre) => {
    if (!(nombre in entradas)) throw new Error("Referenced node is unexecuted: " + nombre);
    const v = entradas[nombre];
    const items = (Array.isArray(v) ? v : [v]).map((json) => ({ json }));
    return { first: () => items[0], all: () => items };
  };
  const items = itemsEntrada.map((json) => ({ json }));
  const $input = { first: () => items[0], all: () => items };
  return new Function("$", "$json", "$input", "$now", codigo)($, items[0] && items[0].json, $input, AHORA);
}

const BOTON = "Hola, quiero hablar contigo \n\n*Enviado desde: https://www.cesteriaaparici.es /shop/7123-persiana-de-esparto-a-medida-4471#attr=*";
function preparar(mensaje, recientes) {
  const entradas = { "Extraer mensaje": { message_text: mensaje } };
  if (recientes !== undefined) entradas["Mensajes recientes"] = recientes;
  return ejecutarItems(nodoBot("Preparar búsqueda"), entradas, [{ module: "whatsapp" }])[0].json;
}

let pbq = preparar("hola");
ok("sin el nodo de mensajes recientes busca solo con el mensaje, como antes",
  pbq.textos_busqueda.length === 1 && pbq.textos_busqueda[0] === "hola", JSON.stringify(pbq.textos_busqueda));
pbq = preparar("hola", [{}]);
ok("y si no hay mensajes recientes (item vacio), igual", pbq.textos_busqueda.length === 1);

pbq = preparar(BOTON);
ok("del boton de la web se queda el producto de la pagina y no la direccion",
  /persiana de esparto a medida/.test(pbq.texto_busqueda) && !/https|cesteriaaparici|4471|attr/.test(pbq.texto_busqueda), pbq.texto_busqueda);
ok("y los terminos del catalogo son los del producto, no los del texto fijo",
  pbq.terminos.includes("persiana") && pbq.terminos.includes("esparto") && !pbq.terminos.includes("hablar") && !pbq.terminos.includes("desde"),
  JSON.stringify(pbq.terminos));
ok("el mensaje que se guarda para la IA no se toca", pbq.pregunta === BOTON);

const RECIENTES = [
  { sender: "bot", content: "Las persianas de esparto a medida tardan entre 4 y 6 semanas en confeccionarse." },
  { sender: "contact", content: "Cuánto tiempo tardan en confeccionarse?" },
  { sender: "bot", content: "Gracias por la información." },
  { sender: "contact", content: "C/Mayor 28" },
];
pbq = preparar("Cuáles son las terminaciones? Creo que hay de varios tipos", RECIENTES);
ok("con mensajes recientes se busca dos veces: el mensaje solo y con lo anterior",
  pbq.textos_busqueda.length === 2 && pbq.textos_busqueda[0] === "Cuáles son las terminaciones? Creo que hay de varios tipos");
ok("el contexto lleva lo ultimo del contacto, la ultima respuesta y el mensaje, en ese orden",
  /^Cuánto tiempo tardan en confeccionarse\?\nLas persianas de esparto[^\n]*\nCuáles son las terminaciones/.test(pbq.textos_busqueda[1]),
  pbq.textos_busqueda[1]);
ok("con palabras de sobra en el mensaje, los terminos del catalogo son solo los suyos",
  !pbq.terminos.includes("persiana"), JSON.stringify(pbq.terminos));

pbq = preparar("?", RECIENTES);
ok("a un «?» se le completan los terminos con lo anterior",
  pbq.terminos.includes("persiana") || pbq.terminos.includes("confeccionarse"), JSON.stringify(pbq.terminos));

const largo = "x".repeat(2000);
pbq = preparar("¿y el largo?", [{ sender: "bot", content: largo }]);
ok("de una respuesta larga solo entra el principio", pbq.textos_busqueda[1].length < 600);

let sep = ejecutarItems(nodoBot("Separar búsquedas"), {}, [{ data: [{ embedding: [1] }, { embedding: [2] }] }]);
ok("Separar busquedas da un item por embedding: 5 fragmentos del mensaje y 3 del contexto",
  sep.length === 2 && sep[0].json.cuantos === 5 && sep[1].json.cuantos === 3 && sep[1].json.embedding[0] === 2);
sep = ejecutarItems(nodoBot("Separar búsquedas"), {}, [{ data: [{ embedding: [1] }] }]);
ok("con un solo texto, una sola busqueda", sep.length === 1 && sep[0].json.cuantos === 5);
let revienta = false;
try { ejecutarItems(nodoBot("Separar búsquedas"), {}, [{}]); } catch (e) { revienta = /embedding/.test(e.message); }
ok("sin embedding falla diciendo por que, no se para en silencio", revienta);

const frag = (t, c) => ({ title: t, content: c, similarity: 0.5 });
const rec = ejecutarItems(nodoBot("Recoger conocimiento"), {},
  [frag("Envios", "a"), frag("Persianas", "b"), {}, frag("Persianas", "b"), frag("Plazos", "c")])[0].json.fragmentos;
ok("Recoger conocimiento junta las dos busquedas sin repetir y en orden",
  rec.map((f) => f.title).join(",") === "Envios,Persianas,Plazos", rec.map((f) => f.title).join(","));

const mr = bot.nodes.find((x) => x.name === "Mensajes recientes");
ok('"Mensajes recientes" no tumba nada si falla y se ejecuta una vez',
  mr.alwaysOutputData === true && mr.onError === "continueRegularOutput" && mr.executeOnce === true);
ok("y va entre el prompt y los modulos, que se piden una sola vez",
  cx["Buscar prompt del cliente"].main[0][0].node === "Mensajes recientes" &&
  cx["Mensajes recientes"].main[0][0].node === "Módulos del cliente" &&
  bot.nodes.find((x) => x.name === "Módulos del cliente").executeOnce === true);
ok("el embedding pasa por Separar busquedas antes de Buscar conocimiento",
  cx["Generar embedding"].main[0][0].node === "Separar búsquedas" &&
  cx["Separar búsquedas"].main[0][0].node === "Buscar conocimiento");

// === Productos con contexto y con su ficha (20/10/2026) =========================
// Conversacion real de Cesteria: garrafas de boca ancha y despues «¿Tenéis con
// forro de plástico?». Salieron leñeros «con forro» y la garrafa con funda de
// plastico no, y aunque hubiera salido, la IA no veia la ficha.

console.log("\n=== El bot: productos con contexto y con ficha ===");

const GARRAFAS = [
  { sender: "bot", content: "Veo que estás interesado en garrafas de boca ancha:\n\n- *Garrafa de vidrio de boca ancha*: 54,34 €\n  https://cesteriaaparici.es/shop/1335-garrafa-de-vidrio-de-boca-ancha-1335\n\n- *Garrafa de boca ancha completa*: 50,38 €\n  https://cesteriaaparici.es/shop/1330-garrafa-de-boca-ancha-completa-1330" },
  { sender: "contact", content: "Quiero saber si disponéis de garrafones de boca ancha de 16 o  20  los" },
];
pbq = preparar("Tenéis  con forro de plástico?", GARRAFAS);
ok("la busqueda del mensaje solo sigue siendo la de siempre", pbq.terminos.join(",") === "forro,plastico", pbq.terminos.join(","));
ok("la de contexto lleva delante el mensaje y detras lo que se hablaba",
  pbq.terminos_contexto.slice(0, 2).join(",") === "forro,plastico" &&
  ["garrafa", "boca", "ancha"].every((t) => pbq.terminos_contexto.includes(t)), pbq.terminos_contexto.join(","));
ok("de nuestra respuesta solo cuentan los productos enlazados, no el texto",
  !pbq.terminos_contexto.includes("interesado") && !pbq.terminos_contexto.includes("veo"), pbq.terminos_contexto.join(","));
ok("como mucho ocho terminos", pbq.terminos_contexto.length <= 8);

let sbp = ejecutarItems(nodoBot("Separar búsquedas de productos"), { "Preparar búsqueda": pbq }, [{}]);
ok("Separar busquedas de productos: la del mensaje con 6 y la de contexto con 4",
  sbp.length === 2 && sbp[0].json.limite === 6 && sbp[1].json.limite === 4 && sbp[1].json.terminos.includes("garrafa"));
sbp = ejecutarItems(nodoBot("Separar búsquedas de productos"), { "Preparar búsqueda": preparar("tenéis leñeros?") }, [{}]);
ok("sin conversacion previa, una sola busqueda", sbp.length === 1 && sbp[0].json.terminos.includes("lenero"));
sbp = ejecutarItems(nodoBot("Separar búsquedas de productos"), { "Preparar búsqueda": preparar("?") }, [{}]);
ok("sin terminos, la de siempre con limite cero (no se busca nada)", sbp.length === 1 && sbp[0].json.limite === 0);

const prod = (name, url, descripcion) => ({ name, url, price: 10, currency: "EUR", available: true, descripcion });
const recP = ejecutarItems(nodoBot("Recoger productos"), {}, [
  prod("Leñero con forro", "u1"), prod("Garrafa de boca ancha completa", "u2"), {}, prod("Garrafa de boca ancha completa", "u2"),
])[0].json.productos;
ok("Recoger productos junta las dos busquedas sin repetir", recP.map((p) => p.url).join(",") === "u1,u2");

// El orden: con los lenos delante, gpt-4o contestaba «no encuentro» 4 de 6 veces.
const LISTA_GARRAFAS = [
  prod("Leñero de Esparto redondo con Forro Arpillera/Yute", "l1", "Elegancia Clásica Un leñero de diseño clásico."),
  prod("Cesto redondo de mimbre, calado con forro", "c1", "Cesto con forro de tela."),
  prod("Garrafa de vidrio forrada boca ancha de caña y mimbre", "g1", "Garrafa de vidrio reciclado con revestimiento de caña."),
  prod("Garrafa de boca ancha completa", "g2", "Garrafas de vidrio hechas en España. Introducidas en una funda de plástico."),
];
let ord = ejecutarItems(nodoBot("Recoger productos"), { "Preparar búsqueda": pbq }, LISTA_GARRAFAS)[0].json.productos;
ok("sube delante lo que encaja con la conversacion Y con la pregunta (la garrafa con funda de plastico)",
  ord[0].url === "g2", ord.map((p) => p.url).join(","));
ok("detras, las demas garrafas de la conversacion, y al final lo que solo comparte la palabra «forro»",
  ord.map((p) => p.url).join(",") === "g2,g1,l1,c1", ord.map((p) => p.url).join(","));

const cambioDeTema = preparar("¿y tenéis lámparas?", GARRAFAS);
ord = ejecutarItems(nodoBot("Recoger productos"), { "Preparar búsqueda": cambioDeTema }, [
  prod("Lámpara colgante de rafia", "la1", "Lámpara de rafia natural."),
  prod("Garrafa de boca ancha completa", "g2", "Introducidas en una funda de plástico."),
])[0].json.productos;
ok("si cambia de tema, lo de antes no se cuela delante", ord[0].url === "la1", ord.map((p) => p.url).join(","));

ord = ejecutarItems(nodoBot("Recoger productos"), {}, LISTA_GARRAFAS)[0].json.productos;
ok("sin la busqueda, se quedan como llegaron", ord.map((p) => p.url).join(",") === "l1,c1,g1,g2");

function contextoTienda(productos, busqueda) {
  const r = ejecutar(nodoBot("Preparar contexto"), {
    "Buscar prompt del cliente": { system_prompt: "Eres la tienda.", knowledge_base: "" },
    "Preparar búsqueda": Object.assign({ tiene_agenda: false }, busqueda),
    "Recoger conocimiento": { fragmentos: [] },
    "Recoger productos": { productos },
    "Extraer mensaje": { message_text: "Tenéis con forro de plástico?", adjunto: null },
  }, {})[0].json;
  return r.messages.map((x) => x.content).join("\n");
}
texto = contextoTienda([
  prod("Garrafa de boca ancha completa", "https://x/1330", "Garrafas de vidrio hechas en España. Introducidas en una funda de plástico, boca ancha y bien acabadas. Descúbrelas!"),
  prod("Garrafa de vidrio de boca ancha", "https://x/1335", "Descripción Material Medidas Usos Colecciones Envíos Meticulosamente moldeado Esta aceitera de vidrio reciclado es una obra maestra. " + "Relleno sin interés. ".repeat(40) + "Ideal para guardar aceite."),
  prod("Producto sin ficha", "https://x/9", null),
], pbq);
ok("a la IA le llega la ficha del producto, con la frase de la funda de plastico",
  /Garrafa de boca ancha completa[^\n]*\n  Ficha: Garrafas de vidrio hechas en España\. Introducidas en una funda de plástico/.test(texto), texto.slice(0, 400));
ok("sin la cabecera de pestañas de Odoo", !/Ficha: Descripción Material/.test(texto));
ok("y recortada: una ficha larga no se manda entera", !/Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés\. Relleno sin interés/.test(texto));
ok("un producto sin descripcion sale como antes, sin linea de ficha", /Producto sin ficha: [^\n]*-> https:\/\/x\/9(\n-|\n\n|$)/.test(texto));

// Tamaños con su precio y su stock (migracion 0031). Los datos son los reales de
// la garrafa el 20/10/2026: el bot la daba «desde 50,38 €», que era la mas cara,
// y la de 16 litros estaba agotada.
texto = contextoTienda([
  Object.assign(prod("Garrafa de boca ancha completa", "https://x/1330", "Garrafa forrada con funda de plástico."), {
    price: 36.99,
    variantes: [
      { nombre: "4 litros", precio: 36.99, stock: 10, se_puede_pedir: true },
      { nombre: "8 litros", precio: 45.24, stock: 11, se_puede_pedir: true },
      { nombre: "16 litros", precio: 50.38, stock: 0, se_puede_pedir: false },
    ],
  }),
  Object.assign(prod("Escoba decorativa de mijo", "https://x/1691", "Escoba pequeña."), { price: 3.05, available: false, variantes: [] }),
], pbq);
ok("con varias opciones, el precio va con «desde»", /Garrafa de boca ancha completa: desde 36,99 €/.test(texto), texto.slice(0, 300));
ok("y debajo cada opcion con su precio, y la agotada marcada",
  /\n  Opciones: 4 litros: 36,99 € \| 8 litros: 45,24 € \| 16 litros: 50,38 € \(agotado\)/.test(texto));
ok("un producto de una sola opcion no lleva linea de opciones ni «desde»",
  /Escoba decorativa de mijo: 3,05 € \(agotado\) -> https:\/\/x\/1691\n  Ficha:/.test(texto));
ok("las reglas explican que cada opcion tiene su precio", /cada opcion \(tamaño, capacidad, tela…\) lleva SU precio/.test(texto));
ok("todos los clientes, tambien las tiendas, saben que dia y hora es", /=== AHORA ===\nHoy es .* y son las /.test(texto));

const muchas = Array.from({ length: 15 }, (_, i) => ({ nombre: "Talla " + i, precio: 10 + i, stock: 1, se_puede_pedir: true }));
texto = contextoTienda([Object.assign(prod("Rejilla", "https://x/r", "Rejilla."), { variantes: muchas })], pbq);
ok("con muchas opciones se enseñan doce y se dice cuantas faltan", /Talla 11: 21,00 € \| y 3 opciones más en la ficha/.test(texto));
ok("Recoger conocimiento -> Separar busquedas de productos -> Buscar productos",
  cx["Recoger conocimiento"].main[0][0].node === "Separar búsquedas de productos" &&
  cx["Separar búsquedas de productos"].main[0][0].node === "Buscar productos");

// === Sinonimos, producto de la conversacion y formato (20/10/2026) ==============
console.log("\n=== El bot: sinonimos y formato ===");
const SINONIMOS = { "leña": ["leñero"], "cistells": ["cesto", "cesta"], "roba": ["ropero"], "clásico": ["bandolera"] };
function prepararCon(mensaje, recientes) {
  const entradas = { "Extraer mensaje": { message_text: mensaje } };
  if (recientes !== undefined) entradas["Mensajes recientes"] = recientes;
  return ejecutarItems(nodoBot("Preparar búsqueda"), entradas, [{ module: "whatsapp", sinonimos: null }, { module: "social", sinonimos: SINONIMOS }])[0].json;
}
let ps = prepararCon("Busco algo para guardar la leña");
ok("«leña» busca tambien «lenero» (el sinonimo va justo detras)", ps.terminos.join(",").includes("lena,lenero"), ps.terminos.join(","));
ps = prepararCon("Bon dia, teniu cistells per a la roba bruta?");
ok("en valenciano tambien encuentra: cistell -> cesto, cesta; roba -> ropero",
  ["cesto", "cesta", "ropero"].every((t) => ps.terminos.includes(t)), ps.terminos.join(","));
ok("sin sinonimos configurados, nada cambia", preparar("Busco algo para guardar la leña").terminos.join(",") === "guardar,lena", preparar("Busco algo para guardar la leña").terminos.join(","));
ok("el modulo de agenda no se confunde con los sinonimos", prepararCon("hola").modulos.join(",") === "whatsapp,social");
ps = ejecutarItems(nodoBot("Preparar búsqueda"), { "Extraer mensaje": { message_text: "¿Cuánto cuesta el capazo clásico?" } },
  [{ module: "social", sinonimos: { "clásico": ["Capazo de palma con asas cortas", "bandolera"] } }])[0].json;
ok("un sinonimo puede ser una frase, con sus espacios, para apuntar a un producto concreto",
  ps.terminos.includes("capazo de palma con asas cortas") && ps.terminos.includes("bandolera"), ps.terminos.join(","));

ps = prepararCon("vale, y la de 61 cm la tenéis?", [
  { sender: "bot", content: "La rejilla se vende por metros lineales." },
  { sender: "contact", content: "hola, aparece el ancho pero no veo por ninguna parte el largo" },
  { sender: "bot", content: "Veo que estabas mirando la Rejilla tupida natural." },
  { sender: "contact", content: "Hola, quiero hablar contigo \n\n*Enviado desde: https://www.cesteriaaparici.es /shop/rejilla-tupida-natural-1532*" },
]);
ok("el producto desde el que llego sigue en la busqueda aunque la ultima respuesta no lo enlace",
  ps.terminos_contexto.includes("rejilla") && ps.terminos.includes("rejilla"), ps.terminos.join(",") + " / " + ps.terminos_contexto.join(","));

const respuestaFinal = (reply) => ejecutar(nodoBot("Respuesta final"), {
  "Preparar contexto": { presentarse: false },
}, { reply })[0].json.reply;
ok("los enlaces en Markdown quedan sueltos, que WhatsApp los hace pulsables",
  respuestaFinal("- *Garrafa*: 36,99 €  [Ver más detalles](https://x.es/1330)") === "- *Garrafa*: 36,99 €  Ver más detalles: https://x.es/1330");
ok("un enlace cuyo texto es la propia direccion queda solo la direccion",
  respuestaFinal("Mira [https://x.es/1](https://x.es/1)") === "Mira https://x.es/1");
ok("la negrita de Markdown pasa a la de WhatsApp", respuestaFinal("Es la **Garrafa de boca ancha**.") === "Es la *Garrafa de boca ancha*.");
ok("el texto normal no se toca", respuestaFinal("Hola, 4 * 2 son 8 y [esto] no es un enlace.") === "Hola, 4 * 2 son 8 y [esto] no es un enlace.");

// === Documentos enteros (22/10/2026, migracion 0032) ============================
console.log("\n=== El bot: documentos enteros ===");
const trozo = (title, content, documento) => ({ title, content, documento, similarity: 0.5 });
const ENVIOS = "Particulares: 4,99 € en la Península, gratis desde 80 €. Baleares 25 €. Canarias, cotización.";
let docs = ejecutarItems(nodoBot("Recoger conocimiento"), {}, [
  trozo("Envíos", "[Envíos] Baleares 25 €. Canarias, cotización.", ENVIOS),
  trozo("Envíos", "[Envíos] Ceuta y Melilla no.", ENVIOS),
  trozo("Pagos", "[Pagos] Tarjeta, Bizum…", "Tarjeta, Bizum, PayPal y transferencia."),
])[0].json.fragmentos;
ok("de un documento que sale en la busqueda llega el documento entero, aunque salieran otros trozos",
  docs.length === 2 && docs[0].content === "[Envíos]\n\n" + ENVIOS && /gratis desde 80/.test(docs[0].content), JSON.stringify(docs.map((d) => d.content)));
ok("y cada documento una sola vez, en el orden en que salio", docs.map((d) => d.title).join(",") === "Envíos,Pagos");
docs = ejecutarItems(nodoBot("Recoger conocimiento"), {}, Array.from({ length: 9 }, (_, i) => trozo("Doc " + i, "trozo " + i, "texto " + i))) [0].json.fragmentos;
ok("como mucho seis documentos", docs.length === 6);
docs = ejecutarItems(nodoBot("Recoger conocimiento"), {}, [trozo("Largo", "t", "x".repeat(15000)), trozo("Otro", "t", "y".repeat(3000))])[0].json.fragmentos;
ok("y sin pasarse de unos 16.000 caracteres (el primero siempre entra)", docs.length === 1 && docs[0].title === "Largo");
docs = ejecutarItems(nodoBot("Recoger conocimiento"), {}, [{ title: "Viejo", content: "[Viejo] trozo" }])[0].json.fragmentos;
ok("si la base aun no devuelve el documento, se usan los trozos como antes", docs.length === 1 && docs[0].content === "[Viejo] trozo");

// === Plan B si OpenAI falla (20/10/2026: la cuenta se quedo sin saldo) =========
console.log("\n=== El bot: si OpenAI falla ===");
const parsear = (json) => ejecutar(nodoBot("Parsear respuesta IA"), {}, json)[0].json;
let pr = parsear({ choices: [{ message: { content: '{"reply": "Hola", "escalar": false}' } }] });
ok("con respuesta buena, la deja tal cual", pr.reply === "Hola" && pr.escalar === false && !pr.fallo_ia);
pr = parsear({ error: { message: "You have no credits remaining.", code: "credit_balance_exhausted" } });
ok("sin saldo: contesta el aviso fijo y lo pasa a una persona", /ahora mismo no puedo responderte/.test(pr.reply) && pr.escalar === true && /credits/.test(pr.fallo_ia));
pr = parsear({ choices: [{ message: { content: "esto no es json" } }] });
ok("con una respuesta que no es JSON, lo mismo", pr.escalar === true && /no puedo responderte/.test(pr.reply));
pr = parsear({ choices: [{ message: { content: '{"reply": "", "escalar": false}' } }] });
ok("con la respuesta vacia, lo mismo", pr.escalar === true);
const llamarIA = bot.nodes.find((x) => x.name === "Llamar a OpenAI");
ok("«Llamar a OpenAI» reintenta y no tumba la ejecucion", llamarIA.retryOnFail === true && llamarIA.maxTries >= 2 && llamarIA.onError === "continueRegularOutput");

// === Ingesta: tamaños, precios y stock de Odoo (migracion 0031) ===============
console.log("\n=== La ingesta: variantes de Odoo ===");
const ingesta = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n", "workflows", "catalogo-ingesta.json"), "utf8"));
const nodoIng = (n) => {
  const x = ingesta.nodes.find((y) => y.name === n);
  if (!x) throw new Error("no existe el nodo " + n + " en catalogo-ingesta.json");
  return x.parameters.jsCode;
};
const conPar = (lista) => lista.map((json, i) => ({ json, pairedItem: { item: i } }));
function ejecutarIng(nombre, refs, entrada) {
  const $ = (n) => ({ all: () => refs[n], first: () => refs[n][0] });
  const $input = { all: () => entrada, first: () => entrada[0] };
  return new Function("$", "$json", "$input", nodoIng(nombre))($, entrada[0] && entrada[0].json, $input);
}

const combis = ejecutarIng("Combinaciones", {}, conPar([
  { url: "https://tienda.es/shop/bandeja-1482", odoo: { template_id: 1482, lineas: [
    { atributo: "Tela", valores: [{ id: 1, nombre: "Azul" }, { id: 2, nombre: "Gris" }] },
    { atributo: "Tamaño", valores: [{ id: 3, nombre: "31 cm" }, { id: 4, nombre: "37 cm" }] },
  ] } },
  { url: "https://tienda.es/shop/escoba-1691", odoo: { template_id: 1691, lineas: [] } },
  { url: "https://tienda.es/shop/otra", odoo: null },
])).map((i) => i.json);
ok("Combinaciones: todas las de dos atributos (2 x 2) y una vacia para el producto sin opciones",
  combis.length === 5 && combis[0].nombre === "Azul, 31 cm" && combis[3].nombre === "Gris, 37 cm" &&
  combis[4].combinacion.length === 0 && combis[4].nombre === "");
ok("con la raiz de la tienda sacada a mano (sin URL)", combis[0].raiz === "https://tienda.es");

const respuesta = (price, free_qty, extra) => ({ jsonrpc: "2.0", result: Object.assign({ price, free_qty, product_type: "product", allow_out_of_stock_order: false }, extra) });
const agrup = ejecutarIng("Agrupar variantes", { "Combinaciones": conPar(combis) }, conPar([
  respuesta(15.49, 0), respuesta(21.300000000000001, 10), respuesta(15.49, 3), { error: { message: "timeout" } },
  respuesta(3.05, 0),
])).map((i) => i.json);
const bandeja = agrup.find((a) => a.url.includes("bandeja"));
const escoba = agrup.find((a) => a.url.includes("escoba"));
ok("Agrupar: una fila por producto, ignorando la combinacion que fallo", agrup.length === 2 && bandeja.variantes.length === 3);
ok("el «desde» es el mas barato que se puede pedir", bandeja.price === 15.49 && bandeja.available === true);
ok("y lo agotado queda marcado", bandeja.variantes[0].se_puede_pedir === false && bandeja.variantes[1].se_puede_pedir === true);
ok("los precios redondeados al centimo", bandeja.variantes[1].precio === 21.3);
ok("un producto sin opciones: sin lista, pero con su stock", escoba.variantes.length === 0 && escoba.available === false);
const sinStock = ejecutarIng("Agrupar variantes", { "Combinaciones": conPar([combis[4]]) }, conPar([
  respuesta(9, 0, { allow_out_of_stock_order: true }),
])).map((i) => i.json);
ok("si la tienda admite pedidos sin stock, se puede pedir", sinStock[0].available === true);
const cxIng = ingesta.connections;
ok("el tramo de variantes va despues de Resumen, en cadena",
  cxIng["Resumen"].main[0][0].node === "Productos de Odoo" && cxIng["Combinaciones"].main[0][0].node === "Precio y stock" &&
  cxIng["Agrupar variantes"].main[0][0].node === "Guardar variantes");
ok('"Precio y stock" va despacio y no tumba nada si falla',
  ingesta.nodes.find((x) => x.name === "Precio y stock").onError === "continueRegularOutput" &&
  ingesta.nodes.find((x) => x.name === "Precio y stock").parameters.options.batching.batch.batchSize <= 5);

console.log("\n" + (fallos === 0 ? "TODO OK" : fallos + " FALLOS"));
process.exit(fallos === 0 ? 0 : 1);
