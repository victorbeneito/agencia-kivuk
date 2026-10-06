#!/usr/bin/env node
/**
 * Monta (o repone) el cliente de demostración «Inmobiliaria Llaves».
 *
 * El alta del cliente, sus tres módulos (WhatsApp, agenda e inmuebles), el
 * horario de la oficina, los tres comerciales con su horario día a día, los
 * cinco tipos de cita del CSV y la matriz de quién hace qué. La cartera de
 * inmuebles va aparte, con `cargar-inmuebles.js`.
 *
 *   node scripts/montar-demo-inmobiliaria.js            # simulación
 *   node scripts/montar-demo-inmobiliaria.js --aplicar  # lo escribe
 *
 * Lo que hace y lo que no, en `scripts/lib/montar-demo.js`. El montaje entero
 * de la demo, en `docs/demo-inmobiliaria-llaves.md`.
 */
const { lanzar } = require('./lib/montar-demo');

const MAÑANA = ['09:30', '13:30'];
const TARDE = ['16:30', '20:00'];
const SABADO = ['10:00', '13:30'];

lanzar({
  cliente: 'Inmobiliaria Llaves',
  csvServicios: 'docs/servicios-inmobiliaria-llaves.csv',
  modulosExtra: ['inmuebles'],

  // Lunes a viernes mañana y tarde, y el sábado por la mañana, que es cuando
  // más visitas se piden: quien trabaja entre semana ve pisos el sábado.
  moduloCalendar: {
    dias_laborables: '1,2,3,4,5,6',
    manana_inicio: '09:30',
    manana_fin: '13:30',
    tarde_inicio: '16:30',
    tarde_fin: '20:00',
    duracion_min: '45',
    paso_min: '15',
    // Lo que lee el cliente en el recordatorio de la víspera.
    recordatorio_negocio: 'Inmobiliaria Llaves',
  },

  /**
   * Tres comerciales, cada uno con lo suyo (1 = lunes ... 6 = sábado):
   *
   *   Marta   venta de vivienda y valoraciones. Mañana y tarde, menos el
   *           miércoles por la tarde, y el sábado.
   *   Javier  alquiler. Sobre todo por las tardes, que es cuando puede ver
   *           pisos quien trabaja; martes y jueves también por la mañana, y el
   *           sábado.
   *   Sergio  locales, naves y oficinas. Por las mañanas, que es cuando abren
   *           los negocios; lunes y miércoles también por la tarde.
   *
   * De ahí salen las frases de la demo: «el alquiler lo lleva Javier, que está
   * por las tardes» y «el sábado por la mañana tienes a Marta y a Javier».
   */
  equipo: [
    { nombre: 'Marta', orden: 0, horario: { 1: [MAÑANA, TARDE], 2: [MAÑANA, TARDE], 3: [MAÑANA], 4: [MAÑANA, TARDE], 5: [MAÑANA, TARDE], 6: [SABADO] } },
    { nombre: 'Javier', orden: 1, horario: { 1: [TARDE], 2: [MAÑANA, TARDE], 3: [TARDE], 4: [MAÑANA, TARDE], 5: [TARDE], 6: [SABADO] } },
    { nombre: 'Sergio', orden: 2, horario: { 1: [MAÑANA, TARDE], 2: [MAÑANA], 3: [MAÑANA, TARDE], 4: [MAÑANA], 5: [MAÑANA] } },
  ],

  // Cada uno lo suyo, con un respaldo para que una visita no dependa de que
  // una sola persona esté libre: Sergio cubre ventas por la mañana y Marta,
  // algún alquiler. Lo que no está aquí lo harían los tres, y no se deja nada
  // fuera a propósito: un tipo de cita olvidado sería reservable con cualquiera.
  soloLosHacen: {
    'Visita a vivienda en venta': ['Marta', 'Sergio'],
    'Visita a vivienda en alquiler': ['Javier', 'Marta'],
    'Visita a local o nave': ['Sergio'],
    'Valoración gratuita de vivienda': ['Marta'],
    'Cita en la oficina': ['Marta', 'Javier', 'Sergio'],
  },

  siguientes: [
    'node scripts/cargar-inmuebles.js docs/inmuebles-inmobiliaria-llaves.csv "Inmobiliaria Llaves" --aplicar',
    'el prompt y el conocimiento (paso 4 de docs/demo-inmobiliaria-llaves.md)',
    'y el número: node scripts/activar-numero-demo.js "Inmobiliaria Llaves" <phone_number_id> <pin> --aplicar',
  ],
});
