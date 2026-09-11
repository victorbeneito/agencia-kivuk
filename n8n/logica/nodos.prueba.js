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

console.log("\n=== Nodo 'Respuesta del motor' (disponibilidad) ===");
const disp = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "disponibilidad", fecha: null, hora: null, servicios: [] }),
  "Cargar contexto": contexto,
}, {})[0].json;
r = ejecutar(nodo("Respuesta del motor"), {}, disp);
ok("devuelve dias con huecos", Array.isArray(r[0].json.dias) && r[0].json.dias.length > 0, String((r[0].json.dias || []).length));
ok("con mensaje ya redactado", typeof r[0].json.mensaje === "string" && r[0].json.mensaje.length > 10, r[0].json.mensaje.slice(0, 120));
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

function decidir(ia, mensaje, tieneAgenda) {
  return ejecutar(nodoBot("Decidir acción"), {
    "Preparar búsqueda": { tiene_agenda: tieneAgenda !== false },
    "Extraer mensaje": { message_text: mensaje },
  }, ia)[0].json;
}

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
  mensaje: "El viernes 2026-09-18 a las 17:00 con Ana está libre.",
  libre: true, reservada: false,
})[0].json;
ok("si solo preguntaba, se le ofrece reservar", /¿Te la reservo\?$/.test(rb.reply), rb.reply);
ok("y no se le pide el correo", !/correo|email/i.test(rb.reply), rb.reply);

rb = ejecutar(nodoBot("Respuesta con agenda"), {}, {
  mensaje: "¡Listo! Tu cita queda confirmada para el viernes.",
  libre: true, reservada: true,
})[0].json;
ok("una cita ya hecha no pregunta nada", !/reservo/.test(rb.reply), rb.reply);

console.log("\n" + (fallos === 0 ? "TODO OK" : fallos + " FALLOS"));
process.exit(fallos === 0 ? 0 : 1);
