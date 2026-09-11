'use strict';

/**
 * El motor de agenda: quién puede atender, cuándo, y qué se le contesta.
 *
 * Este fichero es la única copia de esta lógica. Vive aquí, como JavaScript
 * normal y sin dependencias, y se inyecta tal cual dentro de los nodos Code de
 * `agenda-api.json` (ver `construir-workflows.js`). Cuando estaba escrito
 * directamente en los nodos había tres copias de la misma función de parseo de
 * horas y cada corrección había que hacerla tres veces.
 *
 * No sabe nada de n8n, de Supabase ni de HTTP: recibe el contexto ya cargado y
 * devuelve una decisión. Por eso se puede probar con `node`, que es como se ha
 * escrito — antes de tocar el workflow que hoy está dando citas de verdad.
 *
 * La regla que gobierna todo lo demás: **la IA extrae, el código decide.** Aquí
 * no hay ninguna llamada a un modelo. El texto que llega es materia prima que
 * se empareja contra la lista real de servicios y de trabajadores del negocio.
 */

var ZONA_POR_DEFECTO = 'Europe/Madrid';
var DIAS_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
var NOMBRE_DIA = [
  '', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
];

// === Fechas y zona horaria ===================================================
// Sin Luxon: el nodo de n8n la tiene, pero atarse a ella dejaría este fichero
// sin poder ejecutarse fuera, que es justo lo que lo hace comprobable. Con
// Intl basta y viene en cualquier Node moderno.

function partesEnZona(ms, zona) {
  var fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  var p = {};
  var partes = fmt.formatToParts(new Date(ms));
  for (var i = 0; i < partes.length; i++) p[partes[i].type] = partes[i].value;

  // Algunos motores devuelven "24" para la medianoche con hour12:false.
  var hora = p.hour === '24' ? '00' : p.hour;

  return {
    fecha: p.year + '-' + p.month + '-' + p.day,
    hora: hora + ':' + p.minute,
    diaSemana: DIAS_ISO[p.weekday],
  };
}

/** Milisegundos que hay que sumarle a la hora UTC para leer la hora local. */
function desfase(ms, zona) {
  var p = partesEnZona(ms, zona);
  var comoUtc = Date.UTC(
    Number(p.fecha.slice(0, 4)),
    Number(p.fecha.slice(5, 7)) - 1,
    Number(p.fecha.slice(8, 10)),
    Number(p.hora.slice(0, 2)),
    Number(p.hora.slice(3, 5))
  );
  return comoUtc - Math.floor(ms / 60000) * 60000;
}

/**
 * "2026-09-15" + "17:00" en Madrid -> milisegundos UTC.
 *
 * Se corrige dos veces a propósito. El desfase depende del instante, y el
 * instante es justo lo que se está calculando: en los dos domingos del cambio
 * de hora, el desfase de la suposición no es el del resultado. Con la segunda
 * pasada, una cita a las 10:00 del domingo del cambio sigue siendo a las 10:00.
 */
function instante(fecha, hora, zona) {
  var f = String(fecha).split('-').map(Number);
  var h = String(hora).split(':').map(Number);
  var supuesto = Date.UTC(f[0], f[1] - 1, f[2], h[0], h[1]);
  var ms = supuesto - desfase(supuesto, zona);
  return supuesto - desfase(ms, zona);
}

/** La fecha "YYYY-MM-DD" de dentro de n días, en hora local. */
function fechaSumando(ms, dias, zona) {
  return partesEnZona(ms + dias * 86400000, zona).fecha;
}

function diaSemanaDe(fecha, zona) {
  return partesEnZona(instante(fecha, '12:00', zona), zona).diaSemana;
}

// === Texto ===================================================================

function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

var dosCifras = function (n) { return String(n).padStart(2, '0'); };
var aMinutos = function (h) {
  var p = String(h).split(':').map(Number);
  return p[0] * 60 + p[1];
};
var aTexto = function (m) {
  return dosCifras(Math.floor(m / 60)) + ':' + dosCifras(m % 60);
};

/**
 * La hora escrita en el mensaje manda sobre la que extrae la IA.
 *
 * Se la ha visto devolver `time: null` con la hora delante, y coger la primera
 * opción de su propia lista de alternativas: le pides las 12:30 y reserva las
 * 12:15. El prompt pide que no falle; la red de seguridad va en el código.
 */
function horaDelTexto(txt) {
  var t = String(txt == null ? '' : txt).toLowerCase();
  // El punto suelto no separa horas: "4.08" es una fecha, no las 04:08.
  var patrones = [
    /\blas\s+(\d{1,2})(?:\s*[:.,'’h]\s*(\d{2}))?/,
    /\b(\d{1,2})\s*[:'’]\s*(\d{2})\b/,
    /\b(\d{1,2})\s*[.,]\s*(\d{2})\s*h\b/,
    /\b(\d{1,2})\s*h\s*(\d{2})\b/,
    /\b(\d{1,2})\s*h\b/,
  ];
  for (var i = 0; i < patrones.length; i++) {
    var m = t.match(patrones[i]);
    if (!m) continue;
    var h = Number(m[1]);
    var min = m[2] === undefined ? 0 : Number(m[2]);
    if (h < 24 && min < 60) return dosCifras(h) + ':' + dosCifras(min);
  }
  return null;
}

// === Emparejar lo que piden con lo que hay ===================================

/**
 * Qué servicio del catálogo es "unas mechitas".
 *
 * Se compara contra el nombre y contra los alias, y hay tres formas de encajar,
 * por orden de confianza. El orden es lo importante, no la comparación:
 *
 *   3. **Exacta.** "corte" es «Corte», y se acabó.
 *   2. **El texto contiene al servicio**: "quiero corte y mechas" contiene tanto
 *      «Corte» como «Corte y mechas». Aquí gana el más largo, porque el texto da
 *      para los dos y el largo aprovecha más de lo que la persona ha dicho.
 *   1. **El servicio contiene al texto**: "mecha" encaja en «mechas». Aquí gana
 *      el más CORTO, y esto es justo lo contrario del caso anterior.
 *
 * Mezclar los niveles 1 y 2 en una sola regla de "gana el más largo" hacía que
 * "corte" se llevara «Corte y mechas» —dos horas de cita y solo dos personas
 * capaces de hacerla— cuando lo que pedían era un corte de treinta minutos.
 */
function emparejarServicio(texto, servicios) {
  var t = normalizar(texto);
  if (!t) return null;

  var mejor = null;
  var mejorNivel = -1;
  var mejorPeso = -Infinity;

  for (var i = 0; i < servicios.length; i++) {
    var s = servicios[i];
    var candidatos = [s.nombre].concat(s.alias || []);

    for (var j = 0; j < candidatos.length; j++) {
      var c = normalizar(candidatos[j]);
      if (!c) continue;

      var nivel;
      var peso;

      if (t === c) {
        nivel = 3;
        peso = c.length;
      } else if (t.indexOf(c) !== -1) {
        nivel = 2;
        peso = c.length;
      } else if (c.indexOf(t) !== -1 && t.length >= 3) {
        // El mínimo de tres letras evita que un "a" suelto encaje con todo.
        nivel = 1;
        peso = -c.length;
      } else continue;

      if (nivel > mejorNivel || (nivel === mejorNivel && peso > mejorPeso)) {
        mejor = s;
        mejorNivel = nivel;
        mejorPeso = peso;
      }
    }
  }

  return mejor;
}

function emparejarServicios(textos, servicios) {
  var elegidos = [];
  var desconocidos = [];
  var vistos = {};

  var lista = Array.isArray(textos) ? textos : textos ? [textos] : [];

  for (var i = 0; i < lista.length; i++) {
    var texto = String(lista[i] || '').trim();
    if (!texto) continue;

    var s = emparejarServicio(texto, servicios);
    if (!s) {
      desconocidos.push(texto);
      continue;
    }
    if (vistos[s.id]) continue;
    vistos[s.id] = true;
    elegidos.push(s);
  }

  return { elegidos: elegidos, desconocidos: desconocidos };
}

/** "con ana" -> el trabajador Ana. Solo por nombre: el modelo no sabe ids. */
function emparejarTrabajador(texto, trabajadores) {
  var t = normalizar(texto);
  if (!t) return null;

  var mejor = null;
  var mejorLargo = -1;

  for (var i = 0; i < trabajadores.length; i++) {
    var n = normalizar(trabajadores[i].nombre);
    if (!n) continue;

    // Se compara por palabras completas: "ana" no puede casar con "Anabel".
    var palabras = (' ' + t + ' ').indexOf(' ' + n + ' ') !== -1;
    if (!palabras && t !== n) continue;

    if (n.length > mejorLargo) {
      mejor = trabajadores[i];
      mejorLargo = n.length;
    }
  }

  return mejor;
}

// === Huecos ==================================================================

function ocupacionDe(trabajador, freeBusy) {
  var franjas = [];

  function meter(lista) {
    for (var i = 0; i < (lista || []).length; i++) {
      var f = lista[i];
      franjas.push([
        new Date(f.inicio || f.start).getTime(),
        new Date(f.fin || f.end).getTime(),
      ]);
    }
  }

  meter(trabajador.citas);
  meter(trabajador.ausencias);

  // Lo que la persona se haya bloqueado en su propio calendario de Google.
  // `freeBusy` viene indexado por calendar_id; quien no tenga calendario no
  // aporta nada aquí, y su agenda funciona igual.
  if (trabajador.calendar_id && freeBusy && freeBusy[trabajador.calendar_id]) {
    meter(freeBusy[trabajador.calendar_id].busy);
  }

  return franjas;
}

function solapa(franjas, ini, fin) {
  for (var i = 0; i < franjas.length; i++) {
    if (ini < franjas[i][1] && fin > franjas[i][0]) return true;
  }
  return false;
}

/**
 * Los huecos de una persona para los próximos días.
 *
 * `duracion` es lo que ocupa la cita y `paso` cada cuánto puede empezar una.
 * Son cosas distintas: con duración 60 y paso 15, una franja libre a las 10:00
 * permite reservar también a las 10:15.
 */
function huecosDeTrabajador(trabajador, opciones) {
  var zona = opciones.zona;
  var duracionMs = opciones.duracion * 60000;
  var franjas = ocupacionDe(trabajador, opciones.freeBusy);
  var porFecha = {};

  for (var i = 0; i < opciones.dias; i++) {
    var fecha = fechaSumando(opciones.ahora, i, zona);
    var diaSemana = diaSemanaDe(fecha, zona);

    var tramos = (trabajador.horario || []).filter(function (t) {
      return t.dia === diaSemana;
    });
    if (!tramos.length) continue;

    var horas = [];
    for (var j = 0; j < tramos.length; j++) {
      var cierre = instante(fecha, tramos[j].fin, zona);
      var t = instante(fecha, tramos[j].inicio, zona);

      while (t + duracionMs <= cierre) {
        if (t > opciones.ahora && !solapa(franjas, t, t + duracionMs)) {
          horas.push(partesEnZona(t, zona).hora);
        }
        t += opciones.paso * 60000;
      }
    }

    if (horas.length) {
      // Dos tramos del mismo día pueden generar la misma hora si se solapan en
      // la configuración; se ordena y se quita el repetido.
      horas.sort();
      porFecha[fecha] = horas.filter(function (h, k) {
        return horas.indexOf(h) === k;
      });
    }
  }

  return porFecha;
}

/**
 * Une los huecos de todos los candidatos guardando quién puede en cada uno.
 *
 * Se guarda quién, y no solo que hay hueco, porque al reservar sin persona
 * elegida hay que saber a quién asignárselo — y porque si preguntan "¿quién me
 * puede atender el martes?" la respuesta ya está calculada.
 */
function unirHuecos(candidatos, opciones) {
  var porFecha = {};

  for (var i = 0; i < candidatos.length; i++) {
    var suyos = huecosDeTrabajador(candidatos[i], opciones);

    for (var fecha in suyos) {
      if (!porFecha[fecha]) porFecha[fecha] = {};
      var horas = suyos[fecha];
      for (var j = 0; j < horas.length; j++) {
        if (!porFecha[fecha][horas[j]]) porFecha[fecha][horas[j]] = [];
        porFecha[fecha][horas[j]].push(candidatos[i].id);
      }
    }
  }

  var dias = Object.keys(porFecha).sort().map(function (fecha) {
    var horas = Object.keys(porFecha[fecha]).sort();
    return {
      fecha: fecha,
      dia: NOMBRE_DIA[diaSemanaDe(fecha, opciones.zona)],
      horas: horas,
      quien: porFecha[fecha],
    };
  });

  return dias;
}

/**
 * A quién se le asigna una cita que nadie ha pedido a nombre de alguien.
 *
 * Al que menos ocupado esté ese día, y a igualdad el del `orden` del panel. Dar
 * siempre al primero de la lista carga a una persona y deja al resto vacío;
 * repartir por carga es lo que hace que el hueco siguiente siga existiendo.
 */
function elegirTrabajador(ids, trabajadores, fecha, zona) {
  var indice = {};
  for (var i = 0; i < trabajadores.length; i++) indice[trabajadores[i].id] = trabajadores[i];

  var desde = instante(fecha, '00:00', zona);
  var hasta = desde + 86400000;

  var mejor = null;
  var mejorCarga = Infinity;
  var mejorOrden = Infinity;

  for (var j = 0; j < ids.length; j++) {
    var t = indice[ids[j]];
    if (!t) continue;

    var carga = 0;
    var citas = t.citas || [];
    for (var k = 0; k < citas.length; k++) {
      var ini = new Date(citas[k].inicio).getTime();
      var fin = new Date(citas[k].fin).getTime();
      if (ini < hasta && fin > desde) carga += fin - ini;
    }

    var orden = t.orden == null ? 0 : t.orden;
    if (carga < mejorCarga || (carga === mejorCarga && orden < mejorOrden)) {
      mejor = t;
      mejorCarga = carga;
      mejorOrden = orden;
    }
  }

  return mejor;
}

/**
 * Las alternativas son las más CERCANAS a la hora pedida: la última que cabe
 * antes y unas cuantas después. Ofrecerle las nueve de la mañana a quien pide
 * las doce no le sirve de nada.
 */
function alternativasCerca(dias, fecha, hora) {
  var pedido = aMinutos(hora);

  function cercanas(horas, nDespues) {
    var antes = horas.filter(function (h) { return aMinutos(h) < pedido; }).slice(-1);
    var despues = horas.filter(function (h) { return aMinutos(h) > pedido; }).slice(0, nDespues);
    return antes.concat(despues);
  }

  var salida = [];
  var mismoDia = dias.filter(function (d) { return d.fecha === fecha; })[0];
  if (mismoDia && mismoDia.horas.length) {
    salida.push({ fecha: mismoDia.fecha, dia: mismoDia.dia, horas: cercanas(mismoDia.horas, 4) });
  }

  for (var i = 0; i < dias.length && salida.length < 3; i++) {
    if (dias[i].fecha === fecha || !dias[i].horas.length) continue;
    salida.push({ fecha: dias[i].fecha, dia: dias[i].dia, horas: cercanas(dias[i].horas, 3) });
  }

  return salida.filter(function (a) { return a.horas.length; });
}

/** Agrupa horas seguidas en rangos: "09:00-10:15, 12:15-13:00". */
function rangos(horas, paso) {
  var out = [];
  var ini = null;
  var prev = null;

  for (var i = 0; i < horas.length; i++) {
    var m = aMinutos(horas[i]);
    if (prev !== null && m === prev + paso) { prev = m; continue; }
    if (ini !== null) out.push(ini === prev ? aTexto(ini) : aTexto(ini) + '-' + aTexto(prev));
    ini = m;
    prev = m;
  }
  if (ini !== null) out.push(ini === prev ? aTexto(ini) : aTexto(ini) + '-' + aTexto(prev));

  return out.join(', ');
}

// === La decisión =============================================================

function listaLegible(nombres) {
  if (!nombres.length) return '';
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

/**
 * Resuelve una petición contra el contexto del negocio.
 *
 * El orden de las comprobaciones importa y es el mismo que ya tenía la Agenda
 * API, con dos escalones nuevos delante:
 *
 *   0. ¿Se entiende el servicio que piden? Si no, no se sigue: la duración
 *      depende de él y sin duración los huecos son mentira.
 *   1. ¿Hay alguien que pueda hacerlo? Si han pedido a una persona que no lo
 *      hace, se dice quién sí — no "no hay hueco", que sería falso.
 *   2. ¿Falta fecha u hora? Contesta la IA pidiendo lo que falte.
 *   3. ¿Está ocupado? Se dice ya, con alternativas. No se piden más datos:
 *      sacarle el email a alguien para una cita imposible es sacárselo para nada.
 *   4. ¿Libre y con email? Se reserva.
 */
function resolver(contexto, peticion, ahora) {
  var zona = (contexto.config && contexto.config.zona) || ZONA_POR_DEFECTO;
  var config = contexto.config || {};
  var trabajadores = contexto.trabajadores || [];
  var servicios = contexto.servicios || [];

  var paso = parseInt(config.paso_min || '15', 10);
  var duracionPorDefecto = parseInt(config.duracion_min || '60', 10);
  var nombrar = trabajadores.length > 1;

  var accion = String(peticion.accion || 'disponibilidad').toLowerCase();
  var fecha = peticion.fecha || null;
  var hora = peticion.hora
    ? horaDelTexto(String(peticion.hora)) || String(peticion.hora)
    : null;
  var email = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(peticion.email || '').trim())
    ? String(peticion.email).trim()
    : '';

  // --- 0. Qué servicios piden ----------------------------------------------
  var emparejados = emparejarServicios(peticion.servicios, servicios);
  var elegidos = emparejados.elegidos;

  // `texto` es el mensaje tal cual lo ha escrito la persona, y sirve de pista
  // cuando nadie ha dicho aún qué servicio es. Se mira SOLO si no venía un
  // servicio explícito, y no falla si no encuentra nada: "¿qué horario tenéis?"
  // no nombra ningún servicio y no por eso es una petición equivocada.
  //
  // Existe porque el bot necesita enseñar huecos ANTES de que la IA conteste, y
  // en ese momento lo único que hay es la frase. Sin esto, la única forma de
  // acertar la duración era pedirle antes a la IA que extrajera el servicio, y
  // eso es una llamada al modelo entera por cada mensaje.
  if (!elegidos.length && !emparejados.desconocidos.length && peticion.texto) {
    var pista = emparejarServicio(String(peticion.texto), servicios);
    if (pista) elegidos = [pista];
  }

  if (!elegidos.length && emparejados.desconocidos.length && servicios.length) {
    return {
      ok: true,
      estado: 'servicio_desconocido',
      hay_hueco: false,
      reservada: false,
      desconocidos: emparejados.desconocidos,
      mensaje:
        'No tengo «' + emparejados.desconocidos.join('», «') + '» en la lista. ' +
        'Puedo darte cita para: ' +
        listaLegible(servicios.map(function (s) { return s.nombre; })) + '.',
    };
  }

  // Reservar sin saber qué se va a hacer, en un negocio que tiene servicios
  // definidos, es reservar mal: la duración sería la de por defecto y la cita
  // ocuparía media hora donde hacían falta tres. Y no se puede dejar en manos
  // del prompt, que es una recomendación, no una garantía.
  if (accion === 'reservar' && !elegidos.length && servicios.length) {
    return {
      ok: true,
      estado: 'falta_servicio',
      hay_hueco: false,
      reservada: false,
      fecha: fecha,
      hora: hora,
      mensaje:
        '¿Qué te vas a hacer? Lo necesito para saber cuánto hay que reservarte. ' +
        'Puedo darte cita para: ' +
        listaLegible(servicios.map(function (s) { return s.nombre; })) + '.',
    };
  }

  var duracion = elegidos.length
    ? elegidos.reduce(function (t, s) { return t + s.duracion_min; }, 0)
    : duracionPorDefecto;

  // --- 1. Quién puede atender ----------------------------------------------
  var candidatos = trabajadores.slice();

  for (var i = 0; i < elegidos.length; i++) {
    var puede = elegidos[i].staff || [];
    candidatos = candidatos.filter(function (t) {
      return puede.indexOf(t.id) !== -1;
    });
  }

  var pedido = peticion.trabajador
    ? emparejarTrabajador(peticion.trabajador, trabajadores)
    : null;

  if (peticion.trabajador && !pedido) {
    return {
      ok: true,
      estado: 'trabajador_desconocido',
      hay_hueco: false,
      reservada: false,
      mensaje:
        'No tengo a nadie con ese nombre. Puedo mirarte con ' +
        listaLegible(trabajadores.map(function (t) { return t.nombre; })) + '.',
    };
  }

  if (pedido) {
    var puedeEste = candidatos.filter(function (t) { return t.id === pedido.id; });

    if (!puedeEste.length) {
      // Pedir a alguien que no hace ese servicio no es "no hay hueco": es otra
      // cosa, y decirla mal hace que la persona se vaya creyendo que no hay
      // sitio cuando sí lo hay con otra compañera.
      var quienesSi = candidatos.map(function (t) { return t.nombre; });
      return {
        ok: true,
        estado: 'no_lo_hace',
        hay_hueco: false,
        reservada: false,
        mensaje: quienesSi.length
          ? pedido.nombre + ' no hace ' +
            listaLegible(elegidos.map(function (s) { return s.nombre.toLowerCase(); })) +
            '. Sí lo hace ' + listaLegible(quienesSi) + '. ¿Te va bien con alguien de ellos?'
          : pedido.nombre + ' no hace eso, y ahora mismo no tengo a nadie más que pueda.',
      };
    }

    candidatos = puedeEste;
  }

  if (!candidatos.length) {
    return {
      ok: true,
      estado: 'sin_candidatos',
      hay_hueco: false,
      reservada: false,
      mensaje: 'Ahora mismo no tengo a nadie que pueda atender eso. Te paso con una persona del equipo.',
    };
  }

  // --- 2. Los huecos --------------------------------------------------------
  var opciones = {
    zona: zona,
    ahora: ahora,
    dias: 7,
    duracion: duracion,
    paso: paso,
    freeBusy: contexto.freeBusy || null,
  };

  var dias = unirHuecos(candidatos, opciones);

  // Una fecha fuera de la ventana que se calcula no está "ocupada": es que
  // todavía no llega, o que ya ha pasado. Decir "no está disponible" a quien
  // pide dentro de tres semanas es mentirle, y encima se va convencido de que
  // no hay sitio.
  if (fecha) {
    var hoy = partesEnZona(ahora, zona).fecha;
    var ultimo = fechaSumando(ahora, opciones.dias - 1, zona);

    if (fecha < hoy) {
      return {
        ok: true,
        estado: 'fecha_pasada',
        hay_hueco: false,
        reservada: false,
        fecha: fecha,
        mensaje: 'Esa fecha ya ha pasado. Dime un día a partir de hoy.',
      };
    }

    if (fecha > ultimo) {
      return {
        ok: true,
        estado: 'fuera_de_ventana',
        hay_hueco: false,
        reservada: false,
        fecha: fecha,
        hasta: ultimo,
        mensaje: 'Todavía no tengo abierta la agenda tan lejos. De momento puedo darte cita hasta el ' +
          ultimo + '. Si quieres, te aviso cuando se abra.',
      };
    }
  }

  var base = {
    ok: true,
    duracion_min: duracion,
    paso_min: paso,
    servicios: elegidos.map(function (s) {
      return { id: s.id, nombre: s.nombre, duracion_min: s.duracion_min };
    }),
    // La lista entera de lo que se puede reservar. El bot se la enseña a la IA
    // para que pregunte «¿corte o mechas?» con los nombres de verdad del
    // negocio, en vez de inventarse un catálogo plausible.
    catalogo: servicios.map(function (s) {
      return { nombre: s.nombre, duracion_min: s.duracion_min };
    }),
    candidatos: candidatos.map(function (t) { return t.id; }),
  };

  if (accion === 'disponibilidad' || !fecha || !hora) {
    var soloEseDia = fecha
      ? dias.filter(function (d) { return d.fecha === fecha; })
      : dias;

    var mensaje = soloEseDia.length
      ? soloEseDia.map(function (d) {
          return d.dia + ' ' + d.fecha + ': ' + rangos(d.horas, paso);
        }).join('\n')
      : fecha
        ? 'No queda ningún hueco libre el ' + fecha + '.'
        : 'No queda ningún hueco libre en los próximos 7 días.';

    return Object.assign(base, {
      estado: accion === 'disponibilidad' ? 'disponibilidad' : 'faltan_datos',
      hay_hueco: soloEseDia.length > 0,
      reservada: false,
      fecha: fecha,
      hora: hora,
      dias: soloEseDia,
      mensaje: accion === 'disponibilidad'
        ? mensaje
        : 'Para darte cita necesito el día y la hora.',
    });
  }

  // --- 3. ¿Está libre esa hora? --------------------------------------------
  var dia = dias.filter(function (d) { return d.fecha === fecha; })[0];
  var quien = dia && dia.quien[hora] ? dia.quien[hora] : [];

  if (!quien.length) {
    var alternativas = alternativasCerca(dias, fecha, hora);
    var texto = alternativas
      .map(function (a) { return a.dia + ' ' + a.fecha + ': ' + a.horas.join(', '); })
      .join('\n');

    return Object.assign(base, {
      estado: 'ocupado',
      hay_hueco: false,
      reservada: false,
      fecha: fecha,
      hora: hora,
      alternativas: alternativas,
      mensaje: texto
        ? 'Las ' + hora + ' del ' + fecha + ' no están disponibles. Tengo libre:\n' +
          texto + '\n¿Cuál te viene mejor?'
        : 'Lo siento, no me queda ningún hueco libre en los próximos días.',
    });
  }

  var elegido = pedido && quien.indexOf(pedido.id) !== -1
    ? pedido
    : elegirTrabajador(quien, trabajadores, fecha, zona);

  var conQuien = nombrar ? ' con ' + elegido.nombre : '';

  // --- 4. Libre. ¿Se reserva o solo se comprueba? --------------------------
  var resultado = Object.assign(base, {
    estado: 'libre',
    hay_hueco: true,
    reservada: false,
    fecha: fecha,
    hora: hora,
    dia: dia.dia,
    email: email,
    trabajador: { id: elegido.id, nombre: elegido.nombre, calendar_id: elegido.calendar_id || null },
    inicio: new Date(instante(fecha, hora, zona)).toISOString(),
    fin: new Date(instante(fecha, hora, zona) + duracion * 60000).toISOString(),
    mensaje: 'El ' + dia.dia + ' ' + fecha + ' a las ' + hora + conQuien + ' está libre.',
  });

  // El correo ya no hace falta para reservar, y esto era lo que lo exigía.
  //
  // Se pedía para mandar la confirmación, pero quien reserva por WhatsApp ya
  // está en el sitio donde va a leerla: el propio mensaje que contesta el bot
  // ES la confirmación, y llega al mismo hilo donde luego preguntará "¿a qué
  // hora era?". Un correo, en cambio, cae en una bandeja con doscientos sin
  // leer. Pedirlo costaba un paso más en mitad de la conversación —el más caro,
  // porque dictar un email por el móvil es justo donde la gente abandona— a
  // cambio de un recordatorio peor.
  //
  // Si el negocio quiere el correo igualmente, se lo pide su prompt y viaja en
  // la reserva como hasta ahora. Lo que ya no hace es bloquear la cita.

  return resultado;
}

/** El mensaje de una reserva ya creada. Lo redacta el código, no el modelo. */
function mensajeReservada(datos, nombrar) {
  var conQuien = nombrar && datos.trabajador ? ' con ' + datos.trabajador.nombre : '';
  var queSeHace = (datos.servicios || []).length
    ? ' (' + datos.servicios.map(function (s) { return s.nombre; }).join(' + ') + ')'
    : '';

  return '¡Listo! Tu cita queda confirmada para el ' + datos.dia + ' ' + datos.fecha +
    ' a las ' + datos.hora + conQuien + queSeHace + '.' +
    (datos.email ? ' Te envío la confirmación a ' + datos.email + '.' : '');
}

// === Exportado solo para las pruebas =========================================
// En el nodo Code de n8n `module` no existe y esto no se ejecuta, así que el
// fichero se puede inyectar entero sin recortar nada.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    partesEnZona: partesEnZona,
    instante: instante,
    fechaSumando: fechaSumando,
    diaSemanaDe: diaSemanaDe,
    normalizar: normalizar,
    horaDelTexto: horaDelTexto,
    emparejarServicio: emparejarServicio,
    emparejarServicios: emparejarServicios,
    emparejarTrabajador: emparejarTrabajador,
    huecosDeTrabajador: huecosDeTrabajador,
    unirHuecos: unirHuecos,
    elegirTrabajador: elegirTrabajador,
    alternativasCerca: alternativasCerca,
    rangos: rangos,
    resolver: resolver,
    mensajeReservada: mensajeReservada,
  };
}
