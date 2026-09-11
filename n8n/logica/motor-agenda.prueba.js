'use strict';

/**
 * Pruebas del motor de agenda. Se ejecutan con `node motor-agenda.prueba.js`,
 * sin instalar nada: el motor no tiene dependencias y estas tampoco.
 *
 * Los casos no son inventados: son los que aparecen en una peluquería o en una
 * clínica con varias personas, y los que rompieron la versión de un solo
 * trabajador. Si mañana se toca el motor, esto es lo que dice si sigue bien.
 */

var m = require('./motor-agenda.js');

var fallos = 0;
var total = 0;

function comprobar(titulo, condicion, detalle) {
  total++;
  if (condicion) {
    console.log('  OK   ' + titulo);
  } else {
    fallos++;
    console.log('  FALLO ' + titulo + (detalle ? '\n        -> ' + detalle : ''));
  }
}

function seccion(titulo) {
  console.log('\n=== ' + titulo + ' ===');
}

var ZONA = 'Europe/Madrid';

// Un martes cualquiera de septiembre de 2026, a las 08:00 de Madrid.
var MARTES = m.instante('2026-09-15', '08:00', ZONA);

function horario(dias, tramos) {
  var salida = [];
  dias.forEach(function (d) {
    tramos.forEach(function (t) {
      salida.push({ dia: d, inicio: t[0], fin: t[1] });
    });
  });
  return salida;
}

function trabajador(id, nombre, opciones) {
  opciones = opciones || {};
  return {
    id: id,
    nombre: nombre,
    calendar_id: opciones.calendar_id || null,
    orden: opciones.orden || 0,
    horario: opciones.horario || horario([1, 2, 3, 4, 5], [['09:00', '14:00'], ['16:00', '20:00']]),
    ausencias: opciones.ausencias || [],
    citas: opciones.citas || [],
  };
}

function contexto(trabajadores, servicios, extra) {
  return Object.assign(
    {
      config: { paso_min: '15', duracion_min: '60' },
      trabajadores: trabajadores,
      servicios: servicios || [],
    },
    extra || {}
  );
}

// === Zona horaria ============================================================
seccion('Fechas y cambio de hora');

comprobar(
  'las 17:00 de Madrid en verano son las 15:00 UTC',
  new Date(m.instante('2026-09-15', '17:00', ZONA)).toISOString() === '2026-09-15T15:00:00.000Z',
  new Date(m.instante('2026-09-15', '17:00', ZONA)).toISOString()
);

comprobar(
  'las 17:00 de Madrid en invierno son las 16:00 UTC',
  new Date(m.instante('2026-12-15', '17:00', ZONA)).toISOString() === '2026-12-15T16:00:00.000Z',
  new Date(m.instante('2026-12-15', '17:00', ZONA)).toISOString()
);

// El domingo 25 de octubre de 2026 los relojes se atrasan a las 03:00.
comprobar(
  'el domingo del cambio de hora, las 10:00 siguen siendo las 10:00',
  m.partesEnZona(m.instante('2026-10-25', '10:00', ZONA), ZONA).hora === '10:00',
  m.partesEnZona(m.instante('2026-10-25', '10:00', ZONA), ZONA).hora
);

comprobar(
  'el domingo del cambio de hora en marzo, las 10:00 siguen siendo las 10:00',
  m.partesEnZona(m.instante('2026-03-29', '10:00', ZONA), ZONA).hora === '10:00',
  m.partesEnZona(m.instante('2026-03-29', '10:00', ZONA), ZONA).hora
);

comprobar('el 15/09/2026 es martes (día 2)', m.diaSemanaDe('2026-09-15', ZONA) === 2);
comprobar('el 19/09/2026 es sábado (día 6)', m.diaSemanaDe('2026-09-19', ZONA) === 6);
comprobar('el 20/09/2026 es domingo (día 7)', m.diaSemanaDe('2026-09-20', ZONA) === 7);

// === Emparejar servicios =====================================================
seccion('Reconocer lo que piden');

var SERVICIOS = [
  { id: 's1', nombre: 'Corte', duracion_min: 30, alias: ['corte de pelo'], staff: ['a', 'b', 'c'] },
  { id: 's2', nombre: 'Corte y mechas', duracion_min: 120, alias: ['mechas', 'mechitas'], staff: ['b', 'c'] },
  { id: 's3', nombre: 'Lavado', duracion_min: 15, alias: [], staff: ['a', 'b', 'c'] },
];

comprobar(
  '"unas mechitas" es Corte y mechas',
  m.emparejarServicio('unas mechitas', SERVICIOS).id === 's2'
);
comprobar(
  '"MECHAS" con mayúsculas también',
  m.emparejarServicio('MECHAS', SERVICIOS).id === 's2'
);
comprobar(
  '"corte" a secas es Corte, no Corte y mechas',
  m.emparejarServicio('corte', SERVICIOS).id === 's1',
  JSON.stringify(m.emparejarServicio('corte', SERVICIOS))
);
comprobar(
  '"quiero corte y mechas" gana el nombre más largo',
  m.emparejarServicio('quiero corte y mechas', SERVICIOS).id === 's2',
  JSON.stringify(m.emparejarServicio('quiero corte y mechas', SERVICIOS))
);
comprobar(
  'lo que no está en la lista no se inventa',
  m.emparejarServicio('una permanente', SERVICIOS) === null
);

var varios = m.emparejarServicios(['lavado', 'corte', 'mechas'], SERVICIOS);
comprobar('tres servicios en una visita', varios.elegidos.length === 3, JSON.stringify(varios.elegidos.map(function (s) { return s.nombre; })));
comprobar('sin repetir si lo piden dos veces', m.emparejarServicios(['corte', 'corte de pelo'], SERVICIOS).elegidos.length === 1);
comprobar('lo desconocido se devuelve aparte', m.emparejarServicios(['permanente'], SERVICIOS).desconocidos[0] === 'permanente');

// === Emparejar trabajador ====================================================
seccion('Reconocer a quién piden');

var PLANTILLA = [
  trabajador('a', 'Ana'),
  trabajador('b', 'Bea'),
  trabajador('c', 'Sonia'),
];

comprobar('"Ana" es Ana', m.emparejarTrabajador('Ana', PLANTILLA).id === 'a');
comprobar('"con ana" es Ana', m.emparejarTrabajador('con ana', PLANTILLA).id === 'a');
comprobar('"Anabel" no es Ana', m.emparejarTrabajador('Anabel', PLANTILLA) === null);
comprobar('un nombre que no existe no casa', m.emparejarTrabajador('Pepa', PLANTILLA) === null);

// === Huecos ==================================================================
seccion('Cálculo de huecos');

var soloAna = m.huecosDeTrabajador(trabajador('a', 'Ana'), {
  zona: ZONA, ahora: MARTES, dias: 7, duracion: 60, paso: 15, freeBusy: null,
});

comprobar('el martes tiene huecos', !!soloAna['2026-09-15'], Object.keys(soloAna).join());
comprobar('el sábado no trabaja: no aparece', !soloAna['2026-09-19'], Object.keys(soloAna).join());
comprobar('el primer hueco del martes es a las 09:00', soloAna['2026-09-15'][0] === '09:00', soloAna['2026-09-15'][0]);
comprobar(
  'con duración 60 el último de la mañana es a las 13:00',
  soloAna['2026-09-15'].filter(function (h) { return h < '15:00'; }).pop() === '13:00',
  soloAna['2026-09-15'].join()
);

var conCita = m.huecosDeTrabajador(
  trabajador('a', 'Ana', {
    citas: [{ inicio: new Date(m.instante('2026-09-15', '10:00', ZONA)).toISOString(),
              fin: new Date(m.instante('2026-09-15', '11:00', ZONA)).toISOString() }],
  }),
  { zona: ZONA, ahora: MARTES, dias: 7, duracion: 60, paso: 15, freeBusy: null }
);
comprobar(
  'una cita de 10 a 11 tapa las 09:30, 10:00 y 10:45',
  conCita['2026-09-15'].indexOf('09:30') === -1 &&
  conCita['2026-09-15'].indexOf('10:00') === -1 &&
  conCita['2026-09-15'].indexOf('10:45') === -1,
  conCita['2026-09-15'].join()
);
comprobar(
  'y deja libres las 09:00 y las 11:00',
  conCita['2026-09-15'].indexOf('09:00') !== -1 && conCita['2026-09-15'].indexOf('11:00') !== -1,
  conCita['2026-09-15'].join()
);

var deVacaciones = m.huecosDeTrabajador(
  trabajador('a', 'Ana', {
    ausencias: [{ inicio: new Date(m.instante('2026-09-15', '00:00', ZONA)).toISOString(),
                  fin: new Date(m.instante('2026-09-19', '00:00', ZONA)).toISOString() }],
  }),
  { zona: ZONA, ahora: MARTES, dias: 7, duracion: 60, paso: 15, freeBusy: null }
);
comprobar(
  'de vacaciones toda la semana: ni un hueco hasta el lunes siguiente',
  Object.keys(deVacaciones).join() === '2026-09-21',
  Object.keys(deVacaciones).join()
);

var conGoogle = m.huecosDeTrabajador(
  trabajador('a', 'Ana', { calendar_id: 'ana@cal' }),
  {
    zona: ZONA, ahora: MARTES, dias: 7, duracion: 60, paso: 15,
    freeBusy: {
      'ana@cal': { busy: [{ start: new Date(m.instante('2026-09-15', '12:00', ZONA)).toISOString(),
                            end: new Date(m.instante('2026-09-15', '13:30', ZONA)).toISOString() }] },
    },
  }
);
comprobar(
  'un bloqueo suyo en Google tapa el hueco',
  conGoogle['2026-09-15'].indexOf('12:00') === -1 && conGoogle['2026-09-15'].indexOf('12:45') === -1,
  conGoogle['2026-09-15'].join()
);

comprobar(
  'quien no tiene calendario no se ve afectado por el freeBusy de otro',
  m.huecosDeTrabajador(trabajador('b', 'Bea'), {
    zona: ZONA, ahora: MARTES, dias: 7, duracion: 60, paso: 15,
    freeBusy: { 'ana@cal': { busy: [{ start: new Date(m.instante('2026-09-15', '12:00', ZONA)).toISOString(),
                                      end: new Date(m.instante('2026-09-15', '13:30', ZONA)).toISOString() }] } },
  })['2026-09-15'].indexOf('12:00') !== -1
);

comprobar(
  'un servicio de 2 horas no cabe en una franja de 09 a 14 después de las 12',
  m.huecosDeTrabajador(trabajador('a', 'Ana'), {
    zona: ZONA, ahora: MARTES, dias: 7, duracion: 120, paso: 15, freeBusy: null,
  })['2026-09-15'].filter(function (h) { return h < '15:00'; }).pop() === '12:00'
);

// === La decisión =============================================================
seccion('Decisión completa');

var CTX = contexto(PLANTILLA, SERVICIOS);

var r = m.resolver(CTX, { accion: 'disponibilidad' }, MARTES);
comprobar('disponibilidad sin servicio: hay huecos', r.hay_hueco === true);
comprobar('la duración cae a la del módulo', r.duracion_min === 60, String(r.duracion_min));

r = m.resolver(CTX, { accion: 'disponibilidad', servicios: ['mechas'] }, MARTES);
comprobar('con mechas la duración es 120', r.duracion_min === 120, String(r.duracion_min));
comprobar('y solo son candidatas Bea y Sonia', r.candidatos.join() === 'b,c', r.candidatos.join());

r = m.resolver(CTX, { accion: 'disponibilidad', servicios: ['lavado', 'corte', 'mechas'] }, MARTES);
comprobar('lavado + corte + mechas suman 165 min', r.duracion_min === 165, String(r.duracion_min));
comprobar('candidatas: la intersección, Bea y Sonia', r.candidatos.join() === 'b,c', r.candidatos.join());

r = m.resolver(CTX, { accion: 'comprobar', servicios: ['mechas'], trabajador: 'Ana', fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('Ana no hace mechas: se dice, y se dice quién sí', r.estado === 'no_lo_hace', r.estado);
comprobar('el mensaje nombra a Bea y Sonia', /Bea y Sonia/.test(r.mensaje), r.mensaje);

r = m.resolver(CTX, { accion: 'comprobar', servicios: ['permanente'] }, MARTES);
comprobar('un servicio que no existe no se inventa', r.estado === 'servicio_desconocido', r.estado);

r = m.resolver(CTX, { accion: 'comprobar', trabajador: 'Pepa', fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('una persona que no existe se dice claro', r.estado === 'trabajador_desconocido', r.estado);

r = m.resolver(CTX, { accion: 'comprobar', servicios: ['corte'], trabajador: 'Ana', fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('Ana sí hace cortes: libre', r.estado === 'libre', r.estado + ' ' + r.mensaje);
comprobar('y se le asigna a Ana, que es a quien pidieron', r.trabajador.id === 'a', JSON.stringify(r.trabajador));
comprobar('con varios trabajadores, el mensaje dice con quién', /con Ana/.test(r.mensaje), r.mensaje);

// Reparto: Ana tiene el martes lleno de citas, Bea no.
var repartoCtx = contexto(
  [
    trabajador('a', 'Ana', {
      orden: 0,
      citas: [
        { inicio: new Date(m.instante('2026-09-15', '09:00', ZONA)).toISOString(),
          fin: new Date(m.instante('2026-09-15', '12:00', ZONA)).toISOString() },
      ],
    }),
    trabajador('b', 'Bea', { orden: 1 }),
  ],
  [{ id: 's1', nombre: 'Corte', duracion_min: 30, alias: [], staff: ['a', 'b'] }]
);

r = m.resolver(repartoCtx, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('sin pedir persona, se asigna a la menos cargada', r.trabajador.id === 'b', JSON.stringify(r.trabajador));

// A igualdad de carga manda el orden del panel.
var empateCtx = contexto([trabajador('a', 'Ana', { orden: 0 }), trabajador('b', 'Bea', { orden: 1 })],
  [{ id: 's1', nombre: 'Corte', duracion_min: 30, alias: [], staff: ['a', 'b'] }]);
r = m.resolver(empateCtx, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('a igualdad de carga, manda el orden', r.trabajador.id === 'a', JSON.stringify(r.trabajador));

// Con una sola persona no se la nombra nunca.
var soloUnaCtx = contexto([trabajador('a', 'Principal')], []);
r = m.resolver(soloUnaCtx, { accion: 'comprobar', fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('con un solo trabajador, el mensaje NO dice el nombre', !/Principal/.test(r.mensaje), r.mensaje);

// Ocupado: alternativas cercanas, no las del principio del día.
var llenaCtx = contexto(
  [trabajador('a', 'Ana', {
    citas: [{ inicio: new Date(m.instante('2026-09-15', '17:00', ZONA)).toISOString(),
              fin: new Date(m.instante('2026-09-15', '18:00', ZONA)).toISOString() }],
  })],
  []
);
r = m.resolver(llenaCtx, { accion: 'comprobar', fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('hora ocupada: estado ocupado', r.estado === 'ocupado', r.estado);
comprobar('con alternativas', r.alternativas.length > 0, JSON.stringify(r.alternativas));
comprobar(
  'las alternativas del mismo día son cercanas a las 17:00, no las 09:00',
  r.alternativas[0].horas.indexOf('09:00') === -1,
  JSON.stringify(r.alternativas[0])
);

// El correo ya no hace falta: quien reserva por WhatsApp lee la confirmación
// en el propio chat, y pedirle el email era el paso donde más gente abandona.
r = m.resolver(CTX, { accion: 'reservar', servicios: ['corte'], fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('reservar sin email: se reserva igual', r.estado === 'libre', r.estado);
comprobar('y no se le pide el correo', !/correo|email/i.test(r.mensaje), r.mensaje);

r = m.resolver(CTX, { accion: 'reservar', servicios: ['corte'], fecha: '2026-09-15', hora: '17:00', email: 'a@b.com' }, MARTES);
comprobar('reservar con email: libre y listo para insertar', r.estado === 'libre', r.estado);
comprobar('el email sigue viajando si lo dan', r.email === 'a@b.com', r.email);
comprobar('trae inicio y fin en ISO', /^2026-09-15T15:00/.test(r.inicio), r.inicio);
comprobar('el fin es inicio + 30 min del corte', /^2026-09-15T15:30/.test(r.fin), r.fin);

r = m.resolver(CTX, { accion: 'reservar', servicios: ['corte'], hora: '17:00' }, MARTES);
comprobar('sin fecha no se reserva', r.estado === 'faltan_datos', r.estado);

// Un email destrozado por el reconocimiento de voz no cuenta como email: la
// cita se hace igual, pero no se guarda esa cadena como correo de nadie.
r = m.resolver(CTX, { accion: 'reservar', servicios: ['corte'], fecha: '2026-09-15', hora: '17:00', email: 'ana arroba gmail' }, MARTES);
comprobar('un email mal escrito se ignora', r.email === '', JSON.stringify(r.email));
comprobar('pero no impide la cita', r.estado === 'libre', r.estado);

// === El servicio, cuando el negocio tiene servicios ==========================

// Reservar sin decir qué se hace es reservar mal: la duración sería la de por
// defecto y la cita ocuparía 60 minutos donde hacían falta 120.
r = m.resolver(CTX, { accion: 'reservar', fecha: '2026-09-15', hora: '17:00' }, MARTES);
comprobar('reservar sin servicio: falta_servicio', r.estado === 'falta_servicio', r.estado);
comprobar('y ofrece la lista real', /Lavado/.test(r.mensaje), r.mensaje);
comprobar('no reserva', r.reservada === false, String(r.reservada));

// Consultar sí se puede sin servicio: "¿qué horario tenéis?" no nombra ninguno.
r = m.resolver(CTX, { accion: 'disponibilidad' }, MARTES);
comprobar('consultar sin servicio sigue valiendo', r.estado === 'disponibilidad', r.estado);

// El catálogo viaja para que la IA pregunte con los nombres del negocio.
comprobar('la respuesta trae el catálogo', r.catalogo.length === 3, JSON.stringify(r.catalogo));
var lavadoEnCatalogo = r.catalogo.filter(function (s) { return s.nombre === 'Lavado'; })[0];
comprobar('con su duración', lavadoEnCatalogo && lavadoEnCatalogo.duracion_min === 15, JSON.stringify(r.catalogo));

// === `texto`: deducir el servicio de la frase ================================

// El bot enseña huecos ANTES de que la IA conteste, y ahí lo único que hay es
// la frase que ha escrito la persona.
r = m.resolver(CTX, { accion: 'disponibilidad', texto: 'hola queria unas mechas para el viernes' }, MARTES);
comprobar('deduce el servicio de la frase', r.duracion_min === 120, String(r.duracion_min));
comprobar('y lo dice en servicios', r.servicios.length === 1, JSON.stringify(r.servicios));

// Y no falla cuando la frase no habla de ningún servicio.
r = m.resolver(CTX, { accion: 'disponibilidad', texto: 'que horario teneis los sabados?' }, MARTES);
comprobar('una frase sin servicio no es un error', r.estado === 'disponibilidad', r.estado);
comprobar('y usa la duración por defecto', r.duracion_min === 60, String(r.duracion_min));

// Un servicio explícito manda sobre la pista de la frase.
r = m.resolver(CTX, { accion: 'disponibilidad', servicios: ['lavado'], texto: 'y unas mechas?' }, MARTES);
comprobar('el servicio explícito gana a la pista', r.duracion_min === 15, String(r.duracion_min));

// Un nombre que no existe sigue siendo un error, aunque haya `texto`.
r = m.resolver(CTX, { accion: 'disponibilidad', servicios: ['manicura'], texto: 'quiero manicura' }, MARTES);
comprobar('un servicio que no existe se sigue diciendo', r.estado === 'servicio_desconocido', r.estado);

// La hora escrita manda sobre formatos hablados.
r = m.resolver(CTX, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-09-15', hora: "17h30" }, MARTES);
comprobar('"17h30" se entiende como 17:30', r.hora === '17:30', r.hora);

// Fuera de la ventana de 7 días no es "ocupado": es que todavía no llega.
r = m.resolver(CTX, { accion: 'comprobar', fecha: '2026-10-20', hora: '17:00' }, MARTES);
comprobar('una fecha lejana no se dice como ocupada', r.estado === 'fuera_de_ventana', r.estado);
comprobar('y se dice hasta cuándo hay agenda', r.hasta === '2026-09-21', r.hasta + ' | ' + r.mensaje);

r = m.resolver(CTX, { accion: 'comprobar', fecha: '2026-09-01', hora: '17:00' }, MARTES);
comprobar('una fecha ya pasada se dice como tal', r.estado === 'fecha_pasada', r.estado);

r = m.resolver(CTX, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-09-21', hora: '10:00' }, MARTES);
comprobar('el último día de la ventana sí entra', r.estado === 'libre', r.estado + ' ' + r.mensaje);

// === Rangos ==================================================================
seccion('Texto de disponibilidad');

comprobar(
  'horas seguidas se agrupan en un rango',
  m.rangos(['09:00', '09:15', '09:30', '11:00'], 15) === '09:00-09:30, 11:00',
  m.rangos(['09:00', '09:15', '09:30', '11:00'], 15)
);

var mensajeReserva = m.mensajeReservada({
  dia: 'martes', fecha: '2026-09-15', hora: '17:00', email: 'a@b.com',
  trabajador: { nombre: 'Bea' },
  servicios: [{ nombre: 'Corte' }, { nombre: 'Mechas' }],
}, true);
comprobar('el mensaje de reserva dice con quién y qué', /con Bea \(Corte \+ Mechas\)/.test(mensajeReserva), mensajeReserva);

console.log('\n' + (fallos === 0 ? 'TODO OK (' + total + ' comprobaciones)' : fallos + ' FALLOS de ' + total));
process.exit(fallos === 0 ? 0 : 1);
