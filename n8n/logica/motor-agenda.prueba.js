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
comprobar('y concuerda en plural: «lo hacen»', /Sí lo hacen Bea y Sonia\./.test(r.mensaje), r.mensaje);

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

// Fuera de la ventana no es "ocupado": es que todavía no llega.
r = m.resolver(CTX, { accion: 'comprobar', fecha: '2026-12-20', hora: '17:00' }, MARTES);
comprobar('una fecha lejana no se dice como ocupada', r.estado === 'fuera_de_ventana', r.estado);
comprobar('y se dice hasta cuándo hay agenda', r.hasta === '2026-10-14', r.hasta + ' | ' + r.mensaje);

// === Las dos ventanas: lo que se enseña y hasta cuándo se reserva ===========

// El caso que hacía falta arreglar: alguien pide un día concreto dentro de doce
// días. Antes se le decía que la agenda no llegaba tan lejos; ahora se mira.
r = m.resolver(CTX, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-09-28', hora: '17:00' }, MARTES);
comprobar('una fecha a 13 días se comprueba de verdad', r.estado === 'libre', r.estado + ' | ' + r.mensaje);

r = m.resolver(CTX, { accion: 'reservar', servicios: ['corte'], fecha: '2026-09-28', hora: '17:00' }, MARTES);
comprobar('y se puede reservar', r.estado === 'libre', r.estado);

// Pero preguntar en abierto sigue enseñando una semana: esa lista va dentro del
// prompt en cada mensaje, y treinta días de horas no los lee nadie.
r = m.resolver(CTX, { accion: 'disponibilidad' }, MARTES);
comprobar('preguntar en abierto sigue dando 7 días', r.dias.length <= 7, String(r.dias.length));

// El límite es del negocio: una peluquería lo quiere en dos meses porque quien
// se tiñe vuelve a las cuatro semanas y pide cita al salir.
var CTX60 = Object.assign({}, CTX, { config: Object.assign({}, CTX.config, { dias_reserva: '60' }) });
r = m.resolver(CTX60, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-10-30', hora: '17:00' }, MARTES);
comprobar('con dias_reserva=60, el día 45 entra', r.estado === 'libre', r.estado + ' | ' + r.mensaje);

r = m.resolver(CTX60, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-12-20', hora: '17:00' }, MARTES);
comprobar('y más allá se sigue diciendo que no llega', r.estado === 'fuera_de_ventana', r.estado);
comprobar('con el límite de ESE negocio', r.hasta === '2026-11-13', r.hasta);

// Un valor absurdo en la configuración no puede dejar al negocio sin agenda.
var CTXMAL = Object.assign({}, CTX, { config: Object.assign({}, CTX.config, { dias_reserva: 'pepe' }) });
r = m.resolver(CTXMAL, { accion: 'comprobar', servicios: ['corte'], fecha: '2026-09-28', hora: '17:00' }, MARTES);
comprobar('una configuración inválida cae al valor por defecto', r.estado === 'libre', r.estado);

comprobar('días entre fechas, con cambio de mes', m.diasEntreFechas('2026-09-27', '2026-10-02') === 5,
  String(m.diasEntreFechas('2026-09-27', '2026-10-02')));
// El domingo 25/10/2026 España atrasa la hora: entre esas dos medianoches hay
// 25 horas, y comparar a medianoche daría 1,04 días.
comprobar('y con cambio de hora', m.diasEntreFechas('2026-10-25', '2026-10-26') === 1,
  String(m.diasEntreFechas('2026-10-25', '2026-10-26')));

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

// === Mover una cita ==========================================================
seccion('Mover una cita ya dada');

var CORTE = { id: 'sv-corte', nombre: 'Corte', duracion_min: 30, alias: [], staff: ['t1', 't2'] };
var MECHAS = { id: 'sv-mechas', nombre: 'Mechas', duracion_min: 120, alias: [], staff: ['t2'] };

// La cita a mover: el miércoles a las 17:00 con Ana, un corte de 30 minutos.
var LA_CITA = {
  id: 'cita-1',
  inicio: new Date(m.instante('2026-09-16', '17:00', ZONA)).toISOString(),
  fin: new Date(m.instante('2026-09-16', '17:30', ZONA)).toISOString(),
  staff_id: 't1',
  staff_nombre: 'Ana',
  servicios: [{ id: 'sv-corte', nombre: 'Corte', duracion_min: 30 }],
};

function ctxConLaCita(extra) {
  return contexto(
    [
      trabajador('t1', 'Ana', { citas: [{ id: 'cita-1', inicio: LA_CITA.inicio, fin: LA_CITA.fin }] }),
      trabajador('t2', 'Bea', { orden: 1 }),
    ],
    [CORTE, MECHAS],
    extra
  );
}

var CTXM = ctxConLaCita();

r = m.resolver(CTXM, { accion: 'mover', citas: [], fecha: '2026-09-17', hora: '10:00' }, MARTES);
comprobar('sin cita que mover, lo pasa a una persona', r.estado === 'sin_cita' && r.escalar === true, r.estado);

r = m.resolver(CTXM, {
  accion: 'mover',
  citas: [LA_CITA, Object.assign({}, LA_CITA, { id: 'cita-2' })],
  fecha: '2026-09-17', hora: '10:00',
}, MARTES);
comprobar('con dos citas no adivina cuál, la pasa a una persona', r.estado === 'varias_citas' && r.escalar === true, r.estado);

var EN_GOOGLE = Object.assign({}, LA_CITA, { google_event_id: 'abc123', calendar_id: 'ana@group.calendar.google.com' });

r = m.resolver(CTXM, { accion: 'mover', citas: [EN_GOOGLE], fecha: '2026-09-17', hora: '10:00' }, MARTES);
comprobar('una cita que está en Google se mueve igual, con la misma persona',
  r.estado === 'libre' && r.cita.google_event_id === 'abc123', r.estado + ' ' + r.mensaje);

r = m.resolver(CTXM, { accion: 'mover', citas: [EN_GOOGLE], trabajador: 'Bea', fecha: '2026-09-17', hora: '10:00' }, MARTES);
comprobar('pero cambiarla de persona estando en Google la hace alguien del panel',
  r.estado === 'cita_en_google' && r.escalar === true, r.estado);

r = m.resolver(CTXM, { accion: 'mover', citas: [LA_CITA] }, MARTES);
comprobar('sin día ni hora, pregunta a cuándo', r.estado === 'faltan_datos' && /cambiarla/.test(r.mensaje), r.mensaje);

r = m.resolver(CTXM, { accion: 'mover', citas: [LA_CITA], fecha: '2026-09-17', hora: '10:00' }, MARTES);
comprobar('mueve al día siguiente y sigue con quien la tenía',
  r.estado === 'libre' && r.trabajador.nombre === 'Ana', r.estado + ' ' + JSON.stringify(r.trabajador));
comprobar('y dura lo que ya duraba, no la duración por defecto', r.duracion_min === 30, String(r.duracion_min));
comprobar('se anuncia como un cambio, no como una reserva', r.mover === true && r.cita_id === 'cita-1', JSON.stringify([r.mover, r.cita_id]));
comprobar('y lleva los servicios de la cita, que hay que reescribir',
  r.servicios.length === 1 && r.servicios[0].nombre === 'Corte', JSON.stringify(r.servicios));

// Lo que rompía si el motor no supiera cuál es su propio hueco.
r = m.resolver(CTXM, { accion: 'mover', citas: [LA_CITA], fecha: '2026-09-16', hora: '17:15' }, MARTES);
comprobar('moverla media hora no la hace chocar consigo misma', r.estado === 'libre', r.estado + ' ' + r.mensaje);

// Y el hueco de OTRA persona sí sigue ocupado.
var CTXOCUPADO = contexto(
  [
    trabajador('t1', 'Ana', { citas: [{ id: 'cita-1', inicio: LA_CITA.inicio, fin: LA_CITA.fin }] }),
    trabajador('t2', 'Bea', {
      orden: 1,
      citas: [{
        id: 'otra',
        inicio: new Date(m.instante('2026-09-17', '10:00', ZONA)).toISOString(),
        fin: new Date(m.instante('2026-09-17', '11:00', ZONA)).toISOString(),
      }],
    }),
  ],
  [CORTE, MECHAS]
);
r = m.resolver(CTXOCUPADO, { accion: 'mover', citas: [LA_CITA], trabajador: 'Bea', fecha: '2026-09-17', hora: '10:00' }, MARTES);
comprobar('la cita de otra persona sigue ocupando', r.estado === 'ocupado', r.estado + ' ' + r.mensaje);

// Lo que pasó en la demo dental (29/09/2026): la cita había caído con alguien
// que NO trabaja el día al que se quiere mover. Aquí Ana libra los jueves.
var CTXANALIBRA = contexto(
  [
    trabajador('t1', 'Ana', {
      horario: horario([1, 2, 3, 5], [['09:00', '14:00'], ['16:00', '20:00']]),
      citas: [{ id: 'cita-1', inicio: LA_CITA.inicio, fin: LA_CITA.fin }],
    }),
    trabajador('t2', 'Bea', { orden: 1 }),
  ],
  [CORTE, MECHAS]
);

r = m.resolver(CTXANALIBRA, { accion: 'mover', citas: [LA_CITA], fecha: '2026-09-17', hora: '17:00' }, MARTES);
comprobar('si quien la tenía no está ese día, la hace otra que sepa hacerlo',
  r.estado === 'libre' && r.trabajador.nombre === 'Bea', r.estado + ' ' + r.mensaje);
comprobar('y lo dice, para que no llegue preguntando por Ana',
  /está libre con Bea \(Ana no tiene hueco a esa hora\)\./.test(r.mensaje), r.mensaje);

r = m.resolver(CTXANALIBRA, { accion: 'mover', citas: [LA_CITA], trabajador: 'Ana', fecha: '2026-09-17', hora: '17:00' }, MARTES);
comprobar('pero si pide a Ana por su nombre, se respeta: no está', r.estado === 'ocupado', r.estado);

r = m.resolver(CTXANALIBRA, {
  accion: 'mover', citas: [Object.assign({}, LA_CITA, { google_event_id: 'g1' })], fecha: '2026-09-17', hora: '17:00',
}, MARTES);
comprobar('una cita en Google no cambia de manos: ofrece otras horas con Ana', r.estado === 'ocupado', r.estado);

r = m.resolver(CTXANALIBRA, {
  accion: 'mover', citas: [Object.assign({}, LA_CITA, { servicios: [{ nombre: 'Algo raro', duracion_min: 30 }] })],
  fecha: '2026-09-17', hora: '17:00',
}, MARTES);
comprobar('sin saber qué servicio es, tampoco: nadie sabe si Bea lo hace', r.estado === 'ocupado', r.estado);

// Cambiar de persona al mover: se comprueba que esa persona haga el servicio.
var MECHAS_CITA = Object.assign({}, LA_CITA, {
  servicios: [{ id: 'sv-mechas', nombre: 'Mechas', duracion_min: 120 }],
});
r = m.resolver(CTXM, { accion: 'mover', citas: [MECHAS_CITA], trabajador: 'Ana', fecha: '2026-09-17', hora: '10:00' }, MARTES);
comprobar('pedir a quien no hace ese servicio se dice como tal', r.estado === 'no_lo_hace', r.estado + ' ' + r.mensaje);

seccion('Anular una cita ya dada');

r = m.resolver(CTXM, { accion: 'anular', citas: [] }, MARTES);
comprobar('sin cita que anular, lo pasa a una persona', r.estado === 'sin_cita' && r.escalar === true, r.estado);

r = m.resolver(CTXM, { accion: 'anular', citas: [LA_CITA, Object.assign({}, LA_CITA, { id: 'cita-2' })] }, MARTES);
comprobar('con dos citas no adivina cuál anular', r.estado === 'varias_citas' && /anularte/.test(r.mensaje), r.mensaje);

r = m.resolver(CTXM, { accion: 'anular', citas: [LA_CITA] }, MARTES);
comprobar('con una sola, la deja lista para anular', r.estado === 'anulable' && r.cita_id === 'cita-1', r.estado);
comprobar('y pregunta si de verdad, diciendo cuál es',
  /¿Seguro/.test(r.mensaje) && /miércoles 16-09-2026 a las 17:00 con Ana/.test(r.mensaje), r.mensaje);
comprobar('sin decir que ya está anulada', r.anulada === false, String(r.anulada));

var mensajeCambio = m.mensajeMovida({
  dia: 'jueves', fecha: '2026-09-17', hora: '10:00',
  trabajador: { nombre: 'Ana' },
  cita: LA_CITA,
}, true, ZONA);
comprobar('el mensaje dice de cuándo a cuándo',
  /16-09-2026 a las 17:00/.test(mensajeCambio) && /17-09-2026 a las 10:00/.test(mensajeCambio), mensajeCambio);

var mensajeReserva = m.mensajeReservada({
  dia: 'martes', fecha: '2026-09-15', hora: '17:00', email: 'a@b.com',
  trabajador: { nombre: 'Bea' },
  servicios: [{ nombre: 'Corte' }, { nombre: 'Mechas' }],
}, true);
comprobar('el mensaje de reserva dice con quién y qué', /con Bea \(Corte \+ Mechas\)/.test(mensajeReserva), mensajeReserva);

console.log('\n' + (fallos === 0 ? 'TODO OK (' + total + ' comprobaciones)' : fallos + ' FALLOS de ' + total));
process.exit(fallos === 0 ? 0 : 1);
