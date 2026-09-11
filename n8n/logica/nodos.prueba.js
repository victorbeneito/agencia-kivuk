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

/** Ejecuta un jsCode con un $() y un $json falsos. */
function ejecutar(nombreNodo, entradas, jsonEntrada) {
  const $ = (nombre) => {
    if (!(nombre in entradas)) {
      // n8n lanza si el nodo no se ha ejecutado; el codigo debe sobrevivir.
      throw new Error("Referenced node is unexecuted: " + nombre);
    }
    return { first: () => ({ json: entradas[nombre] }) };
  };
  const fn = new Function("$", "$json", nombreNodo);
  return fn($, jsonEntrada);
}


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

const faltaEmail = ejecutar(nodo("Decidir"), {
  "Leer petición": Object.assign({}, PET, { accion: "reservar", email: null, servicios: ["corte"] }),
  "Cargar contexto": contexto,
}, {})[0].json;
r = ejecutar(nodo("Respuesta del motor"), {}, faltaEmail);
ok("en 'falta_email' NO marca libre (el mensaje ya pide el correo)",
   r[0].json.libre === false && /correo/.test(r[0].json.mensaje),
   JSON.stringify({ estado: r[0].json.estado, libre: r[0].json.libre }) + " " + r[0].json.mensaje);

console.log("\n" + (fallos === 0 ? "TODO OK" : fallos + " FALLOS"));
process.exit(fallos === 0 ? 0 : 1);
