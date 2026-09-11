'use strict';

/**
 * Mete `motor-agenda.js` dentro de los nodos Code que lo necesitan.
 *
 *     node n8n/logica/construir-workflows.js          escribe los workflows
 *     node n8n/logica/construir-workflows.js --check  solo comprueba (para CI)
 *
 * Por qué existe: un nodo Code de n8n no puede hacer `require` de un fichero
 * del repositorio, así que el código tiene que viajar dentro del JSON. La
 * alternativa era escribirlo a mano en cada nodo, que es lo que había antes: la
 * misma función de parseo de horas estaba copiada tres veces y cada corrección
 * había que hacerla tres veces, con lo que era cuestión de tiempo que dejaran
 * de ser iguales.
 *
 * Cómo se marca un nodo: su `jsCode` lleva estas dos líneas, y entre ellas se
 * escribe el motor entero.
 *
 *     // <<< MOTOR >>>
 *     // <<< FIN MOTOR >>>
 *
 * Las marcas se conservan en el fichero generado, así que el script es
 * idempotente: se puede ejecutar tantas veces como haga falta y el resultado es
 * el mismo. Lo de fuera de las marcas no se toca, y ahí es donde cada nodo tiene
 * su propio pegamento con n8n (`$('Nodo').first().json` y demás), que es lo
 * único que cambia de un nodo a otro.
 *
 * El JSON generado se versiona igual que antes: lo que se importa en n8n es el
 * fichero, no esto.
 */

var fs = require('fs');
var path = require('path');

var INICIO = '// <<< MOTOR >>>';
var FIN = '// <<< FIN MOTOR >>>';
var RAIZ = path.join(__dirname, '..');
var MOTOR = path.join(__dirname, 'motor-agenda.js');
var WORKFLOWS = [path.join(RAIZ, 'workflows', 'agenda-api.json')];

function motorIndentado() {
  var codigo = fs.readFileSync(MOTOR, 'utf8');

  return [
    '// ===========================================================================',
    '// NO EDITAR AQUI. Este bloque lo genera n8n/logica/construir-workflows.js a',
    '// partir de n8n/logica/motor-agenda.js. Cualquier cambio hecho en el editor',
    '// de n8n se pierde en la siguiente generacion.',
    '// ===========================================================================',
    codigo.trim(),
  ].join('\n');
}

/** Sustituye lo que haya entre las marcas, dejando las marcas puestas. */
function inyectar(codigo, bloque) {
  var i = codigo.indexOf(INICIO);
  if (i === -1) return null;

  var j = codigo.indexOf(FIN);
  var hasta = j === -1 ? i + INICIO.length : j + FIN.length;

  return codigo.slice(0, i) + INICIO + '\n' + bloque + '\n' + FIN + codigo.slice(hasta);
}

function aplicar(ruta, comprobar) {
  var original = fs.readFileSync(ruta, 'utf8');
  var wf = JSON.parse(original);
  var bloque = motorIndentado();
  var tocados = [];

  for (var i = 0; i < wf.nodes.length; i++) {
    var nodo = wf.nodes[i];
    var codigo = nodo.parameters && nodo.parameters.jsCode;
    if (!codigo) continue;

    var nuevo = inyectar(codigo, bloque);
    if (nuevo === null) continue;

    nodo.parameters.jsCode = nuevo;
    tocados.push(nodo.name);
  }

  if (!tocados.length) {
    // Si nadie lleva la marca, o el fichero ya está generado, no hay nada que
    // hacer; pero avisamos, porque lo normal es que sea un despiste.
    return { ruta: ruta, tocados: [], cambiado: false };
  }

  var salida = JSON.stringify(wf, null, 2) + '\n';

  if (!comprobar) fs.writeFileSync(ruta, salida);

  return { ruta: ruta, tocados: tocados, cambiado: salida !== original };
}

function principal() {
  var comprobar = process.argv.indexOf('--check') !== -1;
  var pendientes = 0;

  for (var i = 0; i < WORKFLOWS.length; i++) {
    var r = aplicar(WORKFLOWS[i], comprobar);
    var nombre = path.relative(RAIZ, r.ruta);

    if (!r.tocados.length) {
      console.log('· ' + nombre + ': sin nodos marcados con ' + INICIO);
      continue;
    }

    if (comprobar && r.cambiado) {
      pendientes++;
      console.log('! ' + nombre + ': DESACTUALIZADO (' + r.tocados.join(', ') + ')');
    } else {
      console.log('· ' + nombre + ': ' + r.tocados.join(', '));
    }
  }

  if (pendientes) {
    console.log('\nHay workflows sin regenerar. Ejecuta: node n8n/logica/construir-workflows.js');
    process.exit(1);
  }
}

principal();
