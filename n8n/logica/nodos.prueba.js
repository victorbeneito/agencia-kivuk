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

function respuestaInmuebles(caso, reply, filasOverride) {
  const b = INM.busquedas[caso] || { filtros: {}, filas: [] };
  const filas = filasOverride || b.filas;
  // Sin filas, `alwaysOutputData` deja pasar un item vacio: eso es lo que llega.
  const items = (filas.length ? filas : [{}]).map((json) => ({ json }));
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
  INM.busquedas.piso_3hab_150k_ontinyent.filas.every((f) => ri.reply.includes(String(f.precio).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €")));
ok("el que se pasa lo dice, y cuanto", /Y este se acerca/.test(ri.reply) && /Se pasa 2\.000 € de lo que me dijiste/.test(ri.reply));
ok("y cierra ofreciendo la visita", /te busco hueco para la visita/.test(ri.reply));
ok("las referencias ensenadas viajan aparte", ri.inmuebles_mostrados.join(",") === "105,102,104", ri.inmuebles_mostrados.join(","));

ri = respuestaInmuebles("piso_sant_josep_130k");
ok("el de otra zona lo dice", /No está en Sant Josep, pero cumple todo lo demás/.test(ri.reply), ri.reply);

ri = respuestaInmuebles("piso_venta_sin_mas");
ok("con muchos, ensena 3 y dice cuantos hay", /^Tengo \d+ que encajan con lo que buscas; te pongo los 3 que más se ajustan:/.test(ri.reply), ri.reply.split("\n")[0]);
ok("y pide lo que falta para afinar", /Si me dices la zona y hasta cuánto quieres gastar, te lo afino más/.test(ri.reply), ri.reply.split("\n\n").slice(-1)[0]);

ri = respuestaInmuebles("local_sin_operacion");
ok("sin decir compra o alquiler, cada ficha lo dice", /Local en alquiler/.test(ri.reply) && /€\/mes/.test(ri.reply));
ok("y en un local no pregunta habitaciones sino metros", /comprar o alquilar y la zona/.test(ri.reply) && !/habitaciones necesitas/.test(ri.reply), ri.reply.split("\n\n").slice(-1)[0]);

ri = respuestaInmuebles("chalet_alquiler_1000");
ok("sin nada que encaje, lo dice y ofrece afinar o avisar", /no tengo nada que cumpla todo eso/.test(ri.reply) && /para que te avise/.test(ri.reply), ri.reply);
ok("y no escala: sigue la conversacion", ri.escalar === false);

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

ri = respuestaInmuebles("piso_3hab_150k_ontinyent", "", [{ error: "500 Internal Server Error" }]);
ok("si la base falla, no improvisa: lo dice y avisa al equipo", /no puedo consultar la cartera/.test(ri.reply) && ri.escalar === true, ri.reply);

console.log("\n=== El bot: el camino de la busqueda ===");
const cx = bot.connections;
ok("la rama sin agenda pasa por ¿Buscar inmuebles?", cx["¿Consultar agenda?"].main[1][0].node === "¿Buscar inmuebles?");
ok("que si busca va a Buscar inmuebles y si no, a Respuesta sin agenda",
  cx["¿Buscar inmuebles?"].main[0][0].node === "Buscar inmuebles" && cx["¿Buscar inmuebles?"].main[1][0].node === "Respuesta sin agenda");
ok("y la respuesta acaba en Respuesta final, que pone la presentacion", cx["Respuesta con inmuebles"].main[0][0].node === "Respuesta final");
ok("la cartera se lee antes de llamar a la IA", cx["Recoger productos"].main[0][0].node === "Cartera de inmuebles" && cx["Cartera de inmuebles"].main[0][0].node === "Consultar agenda");
for (const nombre of ["Cartera de inmuebles", "Buscar inmuebles"]) {
  const n = bot.nodes.find((x) => x.name === nombre);
  ok(`"${nombre}" emite item aunque no encuentre nada o falle`,
    n.alwaysOutputData === true && n.onError === "continueRegularOutput");
}

console.log("\n" + (fallos === 0 ? "TODO OK" : fallos + " FALLOS"));
process.exit(fallos === 0 ? 0 : 1);
