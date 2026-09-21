#!/usr/bin/env node
/**
 * Monta (o repone) el cliente de demostración «Peluquería Mechas».
 *
 * El alta del cliente, sus dos módulos, el horario del negocio, las tres
 * trabajadoras con su horario día a día, los 25 servicios del CSV y la matriz
 * de quién hace qué. A mano son unos doscientos clics, y la parte que más se
 * equivoca —las tardes libres de cada una— es justo la que no se ve luego.
 *
 *   node scripts/montar-demo-peluqueria.js            # simulación
 *   node scripts/montar-demo-peluqueria.js --aplicar  # lo escribe
 *
 * Lo que hace y lo que no, en `scripts/lib/montar-demo.js`. El prompt y el
 * conocimiento tienen sus propios cargadores:
 *
 *   node scripts/cargar-prompt.js docs/prompt-peluqueria-mechas.md "Peluqueria Mechas"
 *   node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "Peluqueria Mechas" --aplicar
 */
const { lanzar } = require('./lib/montar-demo');

const MAÑANA = ['10:00', '14:00'];
const TARDE = ['16:00', '20:00'];

lanzar({
  cliente: 'Peluqueria Mechas',
  csvServicios: 'docs/servicios-peluqueria-mechas.csv',

  /**
   * Horario del negocio. Vive en `client_modules.config` del módulo calendar y
   * es de donde hereda su horario cada trabajadora nueva (`crearTrabajador`),
   * además de dar la duración por defecto mientras el bot no mande el servicio.
   */
  moduloCalendar: {
    dias_laborables: '2,3,4,5,6', // martes a sábado
    manana_inicio: '10:00',
    manana_fin: '14:00',
    tarde_inicio: '16:00',
    tarde_fin: '20:00',
    duracion_min: '60',
    paso_min: '15',
  },

  /**
   * Las tres, con su horario día a día (2 = martes ... 6 = sábado).
   *
   * Cada una libra una tarde distinta y ninguna coincide, así que el salón
   * nunca se queda con una sola persona por la tarde. Que la agenda NO sea un
   * rectángulo perfecto es la mitad de la credibilidad de la demo: una
   * peluquera mira los huecos y lo primero que reconoce es que su semana
   * tampoco es plana.
   */
  equipo: [
    { nombre: 'Ana', orden: 0, horario: { 2: [MAÑANA, TARDE], 3: [MAÑANA], 4: [MAÑANA, TARDE], 5: [MAÑANA, TARDE], 6: [MAÑANA] } },
    { nombre: 'Sonia', orden: 1, horario: { 2: [MAÑANA], 3: [MAÑANA, TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA, TARDE], 6: [MAÑANA] } },
    { nombre: 'Luisa', orden: 2, horario: { 2: [MAÑANA, TARDE], 3: [MAÑANA, TARDE], 4: [MAÑANA, TARDE], 5: [MAÑANA], 6: [MAÑANA] } },
  ],

  /**
   * Quién hace qué. Lo que no aparece aquí lo hacen las tres (lavados,
   * peinados, cortes de mujer, caballero y niños, hidratación y anticaída).
   *
   * De aquí salen las dos frases que mejor venden esto en una peluquería
   * —«Luisa no hace mechas, te las puede hacer Ana o Sonia» y «las novias las
   * lleva Ana»—, así que no es relleno: es el guion.
   */
  soloLosHacen: {
    'Arreglo de barba': ['Luisa'],
    'Retoque de raíz': ['Ana', 'Sonia'],
    'Color completo': ['Ana', 'Sonia'],
    'Matiz': ['Ana', 'Sonia'],
    'Baño de color': ['Ana', 'Sonia'],
    'Mechas medio casco': ['Ana', 'Sonia'],
    'Mechas casco completo': ['Ana', 'Sonia'],
    'Balayage': ['Ana', 'Sonia'],
    'Decoloración': ['Ana', 'Sonia'],
    'Alisado de keratina': ['Ana', 'Sonia'],
    'Botox capilar': ['Ana', 'Sonia'],
    'Permanente': ['Ana', 'Sonia'],
    'Peinado de fiesta': ['Ana', 'Luisa'],
    'Recogido': ['Ana', 'Luisa'],
    'Novia - prueba': ['Ana'],
    'Novia - dia de la boda': ['Ana'],
  },

  siguientes: [
    'node scripts/cargar-prompt.js docs/prompt-peluqueria-mechas.md "Peluqueria Mechas"',
    'node scripts/cargar-conocimiento.js docs/conocimiento-peluqueria-mechas.md "Peluqueria Mechas" --aplicar',
    'y las credenciales de WhatsApp: node scripts/pasar-numero-demo.js "Peluqueria Mechas"',
  ],
});
