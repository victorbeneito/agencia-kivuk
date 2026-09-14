/**
 * Prueba el nodo que decide a quién se avisa.
 *
 *     node n8n/logica/recordatorios.prueba.js
 *
 * Ejecuta el `jsCode` de «Preparar avisos» TAL COMO ha quedado dentro de
 * `recordatorios-citas.json`, con un `$()` y un `$now` de mentira. Es la única
 * forma de comprobar sin mandar WhatsApp de verdad lo que de verdad importa
 * aquí: **a quién NO se le escribe**. Un recordatorio de más no es un fallo que
 * se vea en una pantalla y se arregle; es un mensaje que ya ha llegado al
 * teléfono de la clienta de otro.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const wf = JSON.parse(
  fs.readFileSync(path.join(RAIZ, "n8n", "workflows", "recordatorios-citas.json"), "utf8")
);

let fallos = 0;
function ok(t, c, d) {
  if (c) console.log("  OK   " + t);
  else {
    fallos++;
    console.log("  FALLO " + t + (d ? "\n        -> " + d : ""));
  }
}

const CODIGO = wf.nodes.find((n) => n.name === "Preparar avisos").parameters.jsCode;

// Un jueves de septiembre a las 10:00 de Madrid (08:00 UTC).
const AHORA = Date.parse("2026-09-17T08:00:00Z");
const CLIENTE = "00000000-0000-0000-0000-0000000000c1";

/** Ejecuta el nodo con lo que habrían devuelto los tres nodos de antes. */
function preparar({ citas = [], configs = [], credenciales = [] }) {
  const salidas = {
    "Citas próximas": citas,
    "Configuración de agenda": configs,
    "Credenciales de WhatsApp": credenciales,
  };

  const $ = (nombre) => {
    if (!(nombre in salidas)) throw new Error("Referenced node is unexecuted: " + nombre);
    return { all: () => salidas[nombre].map((json) => ({ json })) };
  };

  const $now = { toMillis: () => AHORA };

  const fn = new Function("$", "$now", CODIGO);
  return fn($, $now);
}

/** Una cita dentro de N horas, con lo que trae la consulta de Supabase. */
function cita(horas, extra = {}) {
  return Object.assign(
    {
      id: "cita-" + horas,
      client_id: CLIENTE,
      inicio: new Date(AHORA + horas * 3600000).toISOString(),
      contacto: "34600111222",
      nombre_contacto: "Marta",
      conversation_id: "conv-1",
      cliente: { name: "Peluquería Mechas" },
      trabajador: { nombre: "Ana" },
      servicios: [{ nombre: "Mechas medio casco", posicion: 0 }],
    },
    extra
  );
}

const CONFIG = { client_id: CLIENTE, activo: "true", horas: "24", zona: "Europe/Madrid" };
const CRED = { client_id: CLIENTE, token: "EAAG...", phone_number_id: "1120415504498664" };

const base = (extra = {}) =>
  preparar(Object.assign({ citas: [cita(24)], configs: [CONFIG], credenciales: [CRED] }, extra));

console.log("\nLa ventana");

ok("una cita a 24 horas con la ventana en 24: se avisa", base().length === 1);
ok("a 23 horas: se avisa", base({ citas: [cita(23)] }).length === 1);
ok("a 25 horas: todavía no", base({ citas: [cita(25)] }).length === 0);
ok("a 3 días: todavía no", base({ citas: [cita(72)] }).length === 0);

ok(
  "a 1 hora: ya no (quien pide cita para dentro de un rato no necesita recordatorio)",
  base({ citas: [cita(1)] }).length === 0
);
ok("a 2 horas justas: es el límite, se avisa", base({ citas: [cita(2)] }).length === 1);

ok(
  "con la ventana en 48 horas, una cita a 40 sí entra",
  base({ citas: [cita(40)], configs: [Object.assign({}, CONFIG, { horas: "48" })] }).length === 1
);
ok(
  "una ventana absurda (500 horas) se recorta a 72",
  base({ citas: [cita(100)], configs: [Object.assign({}, CONFIG, { horas: "500" })] }).length === 0
);
ok(
  "una ventana de 1 hora se sube al mínimo, no deja fuera a todo el mundo",
  base({ citas: [cita(3)], configs: [Object.assign({}, CONFIG, { horas: "1" })] }).length === 1
);
ok(
  "una ventana sin poner son 24 horas",
  base({ configs: [{ client_id: CLIENTE, activo: "true" }] }).length === 1
);

console.log("\nA quién no se le escribe");

ok("sin activar el recordatorio, no se manda nada", base({ configs: [] }).length === 0);
ok(
  "con el recordatorio apagado, tampoco",
  base({ configs: [Object.assign({}, CONFIG, { activo: "false" })] }).length === 0
);
ok(
  "con el recordatorio a null (nunca tocado), tampoco",
  base({ configs: [Object.assign({}, CONFIG, { activo: null })] }).length === 0
);
ok("sin credenciales de WhatsApp, no se manda", base({ credenciales: [] }).length === 0);
ok(
  "con credenciales a medias (sin token), no se manda",
  base({ credenciales: [{ client_id: CLIENTE, phone_number_id: "1" }] }).length === 0
);
ok(
  "la config de OTRO cliente no vale para este",
  base({ configs: [Object.assign({}, CONFIG, { client_id: "otro" })] }).length === 0
);
ok(
  "las credenciales de OTRO cliente tampoco",
  base({ credenciales: [Object.assign({}, CRED, { client_id: "otro" })] }).length === 0
);
ok("una cita sin teléfono se salta", base({ citas: [cita(24, { contacto: "" })] }).length === 0);
ok(
  "un teléfono que no lo es se salta",
  base({ citas: [cita(24, { contacto: "no tiene" })] }).length === 0
);
ok(
  "un número demasiado corto se salta en vez de escribir a cualquiera",
  base({ citas: [cita(24, { contacto: "600111" })] }).length === 0
);

console.log("\nEl teléfono");

ok(
  "nueve dígitos son un número español: se le pone el 34",
  base({ citas: [cita(24, { contacto: "600111222" })] })[0].json.para === "34600111222"
);
ok(
  "escrito como lo escribe la gente: +34 600 11 22 33",
  base({ citas: [cita(24, { contacto: "+34 600 11 22 33" })] })[0].json.para === "34600112233"
);
ok(
  "con 00 delante en vez de +",
  base({ citas: [cita(24, { contacto: "0034600111222" })] })[0].json.para === "34600111222"
);
ok(
  "uno de fuera se deja como está",
  base({ citas: [cita(24, { contacto: "33612345678" })] })[0].json.para === "33612345678"
);

console.log("\nLo que se manda");

const aviso = base()[0].json;

ok("lleva el id de la cita, que es lo que luego se marca", aviso.cita_id === "cita-24");
ok("lleva la conversación para dejarlo escrito en la bandeja", aviso.conversation_id === "conv-1");
ok("la plantilla por defecto es la del recordatorio", aviso.plantilla === "recordatorio_cita");
ok("en español", aviso.idioma === "es");
ok("cuatro parámetros, ni uno más", aviso.parametros.length === 4);
ok("ninguno vacío: Meta rechaza el envío entero si lo está", aviso.parametros.every((p) => p));
ok("1 = el negocio", aviso.parametros[0] === "Peluquería Mechas");
ok(
  "2 = el día, en español y con «mañana» delante cuando toca",
  aviso.parametros[1] === "mañana viernes 18 de septiembre",
  aviso.parametros[1]
);
ok("3 = la hora en la zona del negocio", aviso.parametros[2] === "10:00", aviso.parametros[2]);
ok("4 = con quién", aviso.parametros[3] === "Ana");

ok(
  "el texto guardado dice lo mismo que la plantilla",
  aviso.texto.includes("Peluquería Mechas") &&
    aviso.texto.includes("Día: mañana viernes 18 de septiembre") &&
    aviso.texto.includes("Hora: 10:00") &&
    aviso.texto.includes("Con: Ana"),
  aviso.texto
);

const pasado = base({ citas: [cita(48)], configs: [Object.assign({}, CONFIG, { horas: "72" })] })[0]
  .json;
ok(
  "a dos días no se dice «mañana»",
  pasado.parametros[1] === "sábado 19 de septiembre",
  pasado.parametros[1]
);

ok(
  "sin trabajadora asignada no se queda un hueco vacío",
  base({ citas: [cita(24, { trabajador: null })] })[0].json.parametros[3] === "nosotros"
);

console.log("\nEl horario de invierno");

// Enero: Madrid va a UTC+1, no +2. Una cita a las 10:00 de Madrid son las
// 09:00 UTC, y el aviso tiene que decir 10:00. Formatear en UTC diría 09:00 y
// mandaría a la clienta una hora antes de tiempo, en la mitad del año en que
// nadie lo está probando.
const INVIERNO = Date.parse("2027-01-14T09:00:00Z");
const enInvierno = (() => {
  const salidas = {
    "Citas próximas": [
      {
        id: "invierno",
        client_id: CLIENTE,
        inicio: "2027-01-15T09:00:00Z",
        contacto: "34600111222",
        conversation_id: null,
        cliente: { name: "Peluquería Mechas" },
        trabajador: { nombre: "Sonia" },
      },
    ],
    "Configuración de agenda": [CONFIG],
    "Credenciales de WhatsApp": [CRED],
  };
  const $ = (n) => ({ all: () => salidas[n].map((json) => ({ json })) });
  return new Function("$", "$now", CODIGO)($, { toMillis: () => INVIERNO });
})();

ok("la hora sale en la de Madrid, no en UTC", enInvierno[0].json.parametros[2] === "10:00", enInvierno[0].json.parametros[2]);
ok(
  "y el día también",
  enInvierno[0].json.parametros[1] === "mañana viernes 15 de enero",
  enInvierno[0].json.parametros[1]
);

console.log("\nCuando no hay nada");

ok("sin citas, cero avisos y sin reventar", preparar({}).length === 0);
ok(
  "un item vacío (alwaysOutputData) no se confunde con una cita",
  preparar({ citas: [{}], configs: [{}], credenciales: [{}] }).length === 0
);

console.log("");
if (fallos) {
  console.log(fallos + " comprobaciones fallidas.\n");
  process.exit(1);
}
console.log("Todo correcto.\n");
