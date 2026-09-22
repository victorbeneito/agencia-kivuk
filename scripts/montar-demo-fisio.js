#!/usr/bin/env node
/**
 * Monta (o repone) el cliente de demostración «Clínica Fisioterapia Masajes».
 *
 * El alta del cliente, sus dos módulos, el horario de la clínica, los cuatro
 * fisioterapeutas con su horario día a día, los 15 servicios del CSV y la
 * matriz de quién hace qué.
 *
 *   node scripts/montar-demo-fisio.js            # simulación
 *   node scripts/montar-demo-fisio.js --aplicar  # lo escribe
 *
 * Lo que hace y lo que no, en `scripts/lib/montar-demo.js`. El montaje entero,
 * con el prompt, el conocimiento y el número, en `docs/demo-fisioterapia-masajes.md`.
 */
const { lanzar } = require('./lib/montar-demo');

const MAÑANA = ['09:00', '14:00'];
const TARDE = ['16:00', '21:00'];
const SABADO = ['09:00', '13:00'];

lanzar({
  cliente: 'Clinica Fisioterapia Masajes',
  csvServicios: 'docs/servicios-fisioterapia-masajes.csv',

  // Lunes a sábado, con la tarde hasta las nueve: en fisioterapia la franja que
  // más se pide es la de después del trabajo. El sábado solo abre por la
  // mañana y solo con Pablo, y eso lo dice su horario, no este.
  moduloCalendar: {
    dias_laborables: '1,2,3,4,5,6',
    manana_inicio: '09:00',
    manana_fin: '14:00',
    tarde_inicio: '16:00',
    tarde_fin: '21:00',
    duracion_min: '45',
    paso_min: '15',
  },

  /**
   * Los cuatro, con su horario día a día (1 = lunes ... 6 = sábado).
   *
   * Dos generalistas que cubren casi toda la semana (Pablo y Nuria) y dos
   * especialistas con días propios: Lucía (suelo pélvico) los martes, jueves y
   * viernes por la mañana, y Andrés (osteopatía) sobre todo por las tardes. De
   * ahí salen las frases de la demo: «el suelo pélvico lo lleva Lucía, que está
   * martes y jueves» y «el sábado por la mañana solo está Pablo».
   */
  equipo: [
    // Director, fisioterapia deportiva, punción seca y ondas de choque.
    { nombre: 'Pablo', orden: 0, horario: { 1: [MAÑANA, TARDE], 2: [MAÑANA], 3: [MAÑANA, TARDE], 4: [MAÑANA], 5: [MAÑANA], 6: [SABADO] } },
    // Suelo pélvico, embarazo y postparto, drenaje linfático y pilates.
    { nombre: 'Lucía', orden: 1, horario: { 2: [MAÑANA, TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA] } },
    // Osteópata y fisioterapeuta. Tardes, más el miércoles por la mañana.
    { nombre: 'Andrés', orden: 2, horario: { 1: [TARDE], 2: [TARDE], 3: [MAÑANA, TARDE], 4: [TARDE] } },
    // Fisioterapia general, masajes y pilates. Libra el miércoles por la mañana.
    { nombre: 'Nuria', orden: 3, horario: { 1: [MAÑANA, TARDE], 2: [MAÑANA, TARDE], 3: [TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA, TARDE] } },
  ],

  // Todos los servicios, como en la clínica dental: uno olvidado quedaría
  // reservable con cualquiera, y aquí no todos hacen punción ni suelo pélvico.
  soloLosHacen: {
    'Primera visita': ['Pablo', 'Andrés', 'Nuria'],
    'Sesión de fisioterapia': ['Pablo', 'Andrés', 'Nuria'],
    'Sesión corta': ['Pablo', 'Andrés', 'Nuria'],
    'Punción seca': ['Pablo', 'Andrés'],
    'Masaje descontracturante': ['Pablo', 'Andrés', 'Nuria'],
    'Masaje relajante': ['Lucía', 'Nuria'],
    'Masaje deportivo': ['Pablo', 'Nuria'],
    'Drenaje linfático': ['Lucía'],
    'Osteopatía': ['Andrés'],
    'Suelo pélvico - valoración': ['Lucía'],
    'Suelo pélvico - sesión': ['Lucía'],
    'Pilates terapéutico individual': ['Lucía', 'Nuria'],
    'Ondas de choque': ['Pablo'],
    'Readaptación deportiva': ['Pablo'],
    'Vendaje neuromuscular': ['Pablo', 'Lucía', 'Andrés', 'Nuria'],
  },

  siguientes: [
    'node scripts/cargar-prompt.js docs/prompt-fisioterapia-masajes.md "Clinica Fisioterapia Masajes" --aplicar',
    'node scripts/cargar-conocimiento.js docs/conocimiento-fisioterapia-masajes.md "Clinica Fisioterapia Masajes" --aplicar',
    'node scripts/probar-conocimiento.js "Clinica Fisioterapia Masajes" --bateria docs/preguntas-fisioterapia-masajes.txt',
    'y el número: node scripts/pasar-numero-demo.js "Clinica Fisioterapia Masajes"',
  ],
});
