#!/usr/bin/env node
/**
 * Monta (o repone) el cliente de demostración «Clínica Dental Muelas».
 *
 * El alta del cliente, sus dos módulos, el horario de la clínica, los cuatro
 * profesionales con su horario día a día, los 20 servicios del CSV y la matriz
 * de quién hace qué.
 *
 *   node scripts/montar-demo-clinica.js            # simulación
 *   node scripts/montar-demo-clinica.js --aplicar  # lo escribe
 *
 * Lo que hace y lo que no, en `scripts/lib/montar-demo.js`. El montaje entero,
 * con el prompt, el conocimiento y el número, en `docs/demo-clinica-dental-muelas.md`.
 */
const { lanzar } = require('./lib/montar-demo');

const MAÑANA = ['09:00', '14:00'];
const TARDE = ['16:00', '20:00'];

lanzar({
  cliente: 'Clinica Dental Muelas',
  csvServicios: 'docs/servicios-clinica-dental-muelas.csv',

  // Lunes a viernes. El viernes por la tarde no hay nadie, y eso lo dice el
  // horario de cada uno, no este: aquí solo se fija la plantilla de la que
  // hereda un profesional nuevo.
  moduloCalendar: {
    dias_laborables: '1,2,3,4,5',
    manana_inicio: '09:00',
    manana_fin: '14:00',
    tarde_inicio: '16:00',
    tarde_fin: '20:00',
    duracion_min: '30',
    paso_min: '15',
  },

  /**
   * Los cuatro, con su horario día a día (1 = lunes ... 5 = viernes).
   *
   * Es la forma real de una clínica pequeña: la dentista general y la
   * higienista están casi todos los días, y los especialistas vienen días
   * sueltos. De ahí sale la frase que más vende esto en el sector —«la
   * ortodoncia la lleva la Dra. Marta, que pasa consulta martes y jueves»—,
   * que hoy contesta la recepción al teléfono una y otra vez.
   *
   * Los nombres van sin «Dra.» ni «Dr.»: el motor empareja por palabra
   * completa, y «con la doctora Elena» no contiene «Dra. Elena».
   */
  equipo: [
    // Odontóloga general y directora. Libra el miércoles por la tarde.
    { nombre: 'Elena', orden: 0, horario: { 1: [MAÑANA, TARDE], 2: [MAÑANA, TARDE], 3: [MAÑANA], 4: [MAÑANA, TARDE], 5: [MAÑANA] } },
    // Cirugía oral, implantes y periodoncia: lunes y miércoles todo el día, y
    // viernes por la mañana.
    { nombre: 'Javier', orden: 1, horario: { 1: [MAÑANA, TARDE], 3: [MAÑANA, TARDE], 5: [MAÑANA] } },
    // Ortodoncia y odontopediatría: martes por la tarde y jueves todo el día.
    // La tarde es a propósito: es cuando los niños pueden venir sin faltar al cole.
    { nombre: 'Marta', orden: 2, horario: { 2: [TARDE], 4: [MAÑANA, TARDE] } },
    // Higienista. El lunes por la tarde no está.
    { nombre: 'Carla', orden: 3, horario: { 1: [MAÑANA], 2: [MAÑANA, TARDE], 3: [MAÑANA, TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA] } },
  ],

  /**
   * Quién hace qué. Aquí están TODOS los servicios, al revés que en la
   * peluquería: en una clínica casi nada lo hace cualquiera, y un servicio que
   * se olvidara en esta lista quedaría reservable con la higienista.
   */
  soloLosHacen: {
    'Primera visita': ['Elena', 'Javier'],
    'Revisión': ['Elena', 'Javier'],
    'Limpieza dental': ['Carla'],
    'Revisión y limpieza': ['Carla'],
    'Urgencia': ['Elena', 'Javier'],
    'Empaste': ['Elena'],
    'Endodoncia': ['Elena'],
    'Extracción': ['Elena', 'Javier'],
    'Extracción muela del juicio': ['Javier'],
    'Implante - cirugía': ['Javier'],
    'Corona': ['Elena', 'Javier'],
    'Blanqueamiento': ['Elena', 'Carla'],
    'Carillas': ['Elena'],
    'Periodoncia - raspado': ['Javier', 'Carla'],
    'Estudio de ortodoncia': ['Marta'],
    'Revisión de ortodoncia': ['Marta'],
    'Revisión infantil': ['Marta', 'Elena'],
    'Selladores': ['Marta', 'Carla'],
    'Férula de descarga': ['Elena'],
    'Prótesis removible': ['Elena', 'Javier'],
  },

  siguientes: [
    'node scripts/cargar-prompt.js docs/prompt-clinica-dental-muelas.md "Clinica Dental Muelas"',
    'node scripts/cargar-conocimiento.js docs/conocimiento-clinica-dental-muelas.md "Clinica Dental Muelas" --aplicar',
    'node scripts/probar-conocimiento.js "Clinica Dental Muelas" --bateria docs/preguntas-clinica-dental-muelas.txt',
    'y el número: node scripts/pasar-numero-demo.js "Clinica Dental Muelas"',
  ],
});
