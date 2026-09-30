#!/usr/bin/env node
/**
 * Genera las imágenes de las primeras publicaciones de @agenciakivuk en
 * docs/material-venta/instagram/, a 1080×1350 (el 4:5 del feed).
 *
 *   node scripts/generar-posts-instagram.js                 (todas)
 *   node scripts/generar-posts-instagram.js 1-quien-soy-2   (solo esa)
 *
 * Cada diapositiva es una página HTML que se fotografía con Edge (o Chrome) en
 * modo headless. Se hace así y no con SVG, como las tarjetas de las demos,
 * porque aquí casi todo son conversaciones de WhatsApp: burbujas que crecen con
 * el texto, horas en la esquina y saltos de línea. En SVG eso es colocar cada
 * línea a mano; en HTML lo hace el navegador.
 *
 * Los chats salen de conversaciones reales con la demo de Peluquería Mechas
 * (septiembre de 2026), con las fechas ya en el formato que usa hoy el bot. No
 * hay ninguna respuesta que el bot no dé: una imagen que promete lo que el
 * producto no hace se descubre en la primera demo.
 *
 * Los textos de cada publicación (pie, hashtags, orden) están en
 * docs/material-venta/instagram/textos.md.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.join(RAIZ, 'docs', 'material-venta', 'instagram');
const LOGO = path.join(RAIZ, 'app', 'public', 'kivuk-logo.png');
const W = 1080;
const H = 1350;

// Chrome primero: Edge, si ya hay una ventana suya abierta, a veces le pasa el
// trabajo a ese proceso y devuelve el control antes de escribir la imagen.
const NAVEGADORES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

// --- piezas ---------------------------------------------------------------
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lineas = (t) => esc(t).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

/** Una burbuja. `de`: 'ella' (la clienta, a la derecha) o 'bot' (el salón). */
function burbuja({ de, texto, hora, titulo }) {
  return `<div class="fila ${de}"><div class="burbuja ${de}">${titulo ? `<div class="tit">${esc(titulo)}</div>` : ''}${lineas(texto)}<span class="hora">${esc(hora)}${de === 'ella' ? ' <span class="checks">✓✓</span>' : ''}</span></div></div>`;
}

function chat({ negocio, mensajes, aviso }) {
  const cuerpo = mensajes
    .map((m) => (m.separador ? `<div class="separador">${esc(m.separador)}</div>` : burbuja(m)))
    .join('');
  return `
  <div class="movil">
    <div class="cabecera">
      <div class="avatar">${esc(negocio.charAt(0))}</div>
      <div><div class="nombre">${esc(negocio)}</div><div class="estado">en línea</div></div>
    </div>
    ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ''}
    <div class="conversacion">${cuerpo}</div>
  </div>`;
}

function pagina({ eyebrow, titulo, texto, contenido = '', pie = true, fondo = 'claro', paso }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=block" rel="stylesheet">
<style>
  :root { --azul:#8eb9c5; --hondo:#3b7686; --gris:#686765; --arena:#d0bc82; --teja:#b45831; --pizarra:#2b3f4d; --crema:#f6f2ea; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:${W}px; height:${H}px; overflow:hidden; }
  body { font-family:'Poppins', sans-serif; background:var(--crema); color:var(--pizarra);
         display:flex; flex-direction:column; padding:72px 84px 52px; }
  body.oscuro { background:var(--pizarra); color:#fff; }
  body.oscuro .texto { color:#d7e3e7; }
  body.oscuro .eyebrow { color:var(--arena); }
  .eyebrow { font-size:28px; letter-spacing:6px; text-transform:uppercase; color:var(--teja); font-weight:500; }
  h1 { font-size:74px; line-height:1.08; font-weight:700; margin-top:22px; letter-spacing:-1px; }
  h1 em { font-style:normal; color:var(--hondo); }
  body.oscuro h1 em { color:var(--azul); }
  .texto { font-size:36px; line-height:1.45; color:var(--gris); margin-top:28px; }
  .texto b { color:var(--pizarra); font-weight:600; }
  body.oscuro .texto b { color:#fff; }
  /* Todo el bloque centrado en vertical: arriba del todo, una diapositiva de
     solo texto dejaba media imagen vacía y en el feed parecía sin terminar. */
  .cuerpo { flex:1; display:flex; flex-direction:column; justify-content:center; }
  .contenido { display:flex; flex-direction:column; margin-top:40px; }
  .contenido:empty { display:none; }
  .pie { display:flex; align-items:center; justify-content:space-between; margin-top:28px; }
  .pie img { height:84px; }
  body.oscuro .pie img { filter:brightness(0) invert(1); opacity:.9; }
  .pie span { font-size:26px; color:var(--gris); }
  body.oscuro .pie span { color:#b9c6cc; }
  .paso { font-size:26px; color:var(--hondo); font-weight:600; }

  /* WhatsApp, con sus colores a propósito: el reconocimiento es instantáneo. */
  .movil { background:#efeae2; border-radius:36px; overflow:hidden; box-shadow:0 30px 60px rgba(43,63,77,.18); }
  .cabecera { background:#008069; color:#fff; display:flex; align-items:center; gap:22px; padding:24px 30px; }
  .avatar { width:62px; height:62px; border-radius:50%; background:#cfe9e3; color:#008069; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:30px; }
  .nombre { font-size:30px; font-weight:600; }
  .estado { font-size:22px; opacity:.85; }
  .aviso { background:#fff4d6; color:#6b5415; font-size:24px; padding:16px 30px; border-bottom:1px solid #eadfb8; }
  .conversacion { padding:26px 26px 30px; display:flex; flex-direction:column; gap:14px; }
  .fila { display:flex; }
  .fila.ella { justify-content:flex-end; }
  .burbuja { max-width:82%; font-size:28px; line-height:1.4; padding:14px 20px 12px; border-radius:18px; color:#111b21; box-shadow:0 1px 1px rgba(0,0,0,.08); }
  .burbuja.bot { background:#fff; border-top-left-radius:4px; }
  .burbuja.persona { background:#fff; border-top-left-radius:4px; border-left:6px solid var(--teja); }
  .burbuja.ella { background:#d9fdd3; border-top-right-radius:4px; }
  .burbuja .tit { font-weight:700; margin-bottom:6px; }
  .hora { display:block; text-align:right; font-size:19px; color:#667781; margin-top:4px; }
  .checks { color:#53bdeb; letter-spacing:-3px; }
  .separador { align-self:center; background:#fff; color:#54656f; font-size:22px; padding:8px 20px; border-radius:12px; box-shadow:0 1px 1px rgba(0,0,0,.06); }

  .tarjetas { display:flex; flex-direction:column; gap:26px; }
  .tarjeta { background:#fff; border-radius:28px; padding:30px 36px; box-shadow:0 12px 30px rgba(43,63,77,.08); }
  .tarjeta .sector { font-size:24px; letter-spacing:4px; text-transform:uppercase; color:var(--teja); font-weight:500; }
  .tarjeta .num { font-size:46px; font-weight:700; margin-top:6px; }
  .tarjeta .preg { font-size:28px; color:var(--gris); margin-top:6px; }
  .grande { font-size:96px; line-height:1.02; font-weight:700; letter-spacing:-2px; }
</style></head>
<body class="${fondo}">
  <main class="cuerpo">
  ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
  ${titulo ? `<h1>${titulo}</h1>` : ''}
  ${texto ? `<div class="texto">${texto}</div>` : ''}
  <div class="contenido">${contenido}</div>
  </main>
  ${pie ? `<div class="pie"><img src="${'file:///' + LOGO.replace(/\\/g, '/')}" alt=""><span>${paso ? `<span class="paso">${esc(paso)}</span>` : 'agenciakivuk.com'}</span></div>` : ''}
</body></html>`;
}

// --- las publicaciones ----------------------------------------------------
const MECHAS = 'Peluquería Mechas';

const DIAPOSITIVAS = {
  // 1. Quién soy. La primera diapositiva es una foto de Víctor, que no sale de
  //    aquí; esta es la segunda.
  //    El texto es de Víctor. Abajo, la web y no «enlace en la bio»: la bio no
  //    siempre lleva a las demos, y la imagen no puede prometer lo que no hay.
  '1-quien-soy-2': pagina({
    eyebrow: 'Hola',
    titulo: 'Soy Víctor,<br>de <em>Ontinyent</em>.',
    texto:
      'Ayudo a <b>peluquerías, clínicas y comercios</b> de la Vall d’Albaida a atender a sus clientes por WhatsApp ' +
      'sin tener que estar pendientes del móvil todo el día.<br><br>' +
      'Creo asistentes que responden preguntas, gestionan citas y atienden a tus clientes automáticamente, ' +
      '<b>incluso fuera de horario</b>. Y si en algún momento hace falta que intervengas tú, <b>el asistente te avisa</b>.<br><br>' +
      'Así puedes <b>seguir trabajando</b> mientras WhatsApp se encarga de atender a tus clientes.',
    contenido: '',
  }),

  // 2. Carrusel «23:41».
  '2-2341-1': pagina({
    fondo: 'oscuro',
    eyebrow: 'Peluquerías',
    titulo: '',
    contenido:
      '<div class="grande">Son las <span style="color:var(--arena)">23:41</span>.<br>Una clienta<br>quiere mechas.</div>' +
      '<div class="texto" style="margin-top:44px">Tu salón está cerrado.<br><b>Tu WhatsApp, no.</b></div>',
    paso: 'Desliza →',
  }),
  '2-2341-2': pagina({
    eyebrow: 'Pregunta el precio',
    titulo: '',
    contenido: chat({
      negocio: MECHAS,
      mensajes: [
        { de: 'ella', texto: 'Hola, ¿cuánto cuestan unas mechas?', hora: '23:41' },
        {
          de: 'bot',
          texto:
            'Hola, soy el asistente virtual de Peluquería Mechas.\n\n' +
            'Tenemos:\n- Mechas de medio casco: 55 € (2 horas y media).\n- Mechas de casco completo: 70 € (3 horas).\n\n' +
            '¿Te gustaría que te reserve una cita?',
          hora: '23:41',
        },
      ],
    }),
    paso: '2 / 4',
  }),
  '2-2341-3': pagina({
    eyebrow: 'Pide hora, y con quién',
    titulo: '',
    contenido: chat({
      negocio: MECHAS,
      mensajes: [
        { de: 'ella', texto: 'Mañana a las 18h, con Sonia si puede', hora: '23:42' },
        {
          de: 'bot',
          texto: 'Las 18:00 no están disponibles. Tengo libre:\nmiércoles 30-09-2026: 17:00\njueves 01-10-2026: 11:00\n¿Cuál te viene mejor?',
          hora: '23:42',
        },
        { de: 'ella', texto: 'A las 17h', hora: '23:43' },
        {
          de: 'bot',
          texto: '¡Listo! Tu cita queda confirmada para el miércoles 30-09-2026 a las 17:00 con Sonia (Mechas casco completo).',
          hora: '23:43',
        },
      ],
    }),
    paso: '3 / 4',
  }),
  '2-2341-4': pagina({
    eyebrow: 'A la mañana siguiente',
    titulo: 'Tienes una cita más en la agenda, y <em>no has tocado el móvil</em>.',
    texto:
      'Con tus precios.<br>Con los huecos reales de cada una.<br>Sin inventarse nada.<br><br>' +
      '<b>Pruébalo tú en agenciakivuk.com/#probar</b>',
    paso: '4 / 4',
  }),

  // 3. El recordatorio.
  '3-recordatorio': pagina({
    eyebrow: 'La silla vacía',
    titulo: 'La víspera, tu clienta <em>recibe esto</em>.',
    contenido: chat({
      negocio: MECHAS,
      mensajes: [
        {
          de: 'bot',
          titulo: 'Recordatorio de tu cita',
          texto:
            'Te recordamos tu cita en Peluquería Mechas.\n\nDía: mañana miércoles 30 de septiembre\nHora: 11:00\nCon: Ana\n\n' +
            'Si no puedes venir o quieres cambiarla, contéstanos a este mensaje y lo vemos.',
          hora: '09:05',
        },
        { de: 'ella', texto: 'Uy, mañana no puedo. ¿Me la pasas al jueves?', hora: '09:12' },
        { de: 'bot', texto: 'El jueves 01-10-2026 a las 11:00 está libre. ¿Te la cambio?', hora: '09:12' },
      ],
    }),
  }),

  // 4. No se inventa nada.
  '4-no-se-inventa': pagina({
    eyebrow: 'Lo que más miedo da',
    titulo: 'Lo que no sabe, <em>no se lo inventa</em>.',
    contenido:
      chat({
        negocio: MECHAS,
        mensajes: [
          { de: 'ella', texto: 'Tengo el pelo muy fino, ¿puedo tener problemas si me hago mechas?', hora: '08:25' },
          {
            de: 'bot',
            texto:
              'Eso depende mucho del estado de tu pelo, y es difícil valorarlo sin verlo en persona. ' +
              'Lo mejor es que una de las chicas te lo mire en el salón antes de hacer las mechas.',
            hora: '08:25',
          },
        ],
      }) +
      '<div class="texto" style="margin-top:40px">Responde con <b>tu información</b>. Si le preguntan algo que no está ahí, lo dice y <b>te avisa a ti</b>.</div>',
  }),

  // 5. El relevo.
  '5-se-calla': pagina({
    eyebrow: 'Sigues mandando tú',
    titulo: 'Cuando entras tú, <em>el bot se calla</em>.',
    contenido:
      chat({
        negocio: MECHAS,
        aviso: '🔔  Marta quiere hablar con una persona',
        mensajes: [
          { de: 'ella', texto: 'Prefiero hablar con alguien del salón', hora: '17:20' },
          { de: 'bot', texto: 'Claro, aviso ahora mismo al equipo y te escriben por aquí.', hora: '17:20' },
          { separador: 'Ana ha entrado en la conversación' },
          { de: 'persona', texto: 'Hola Marta, soy Ana. Dime, ¿qué necesitas? 😊', hora: '17:24' },
        ],
      }) +
      '<div class="texto" style="margin-top:40px">Te suena el móvil, entras y sigues tú. Todas las conversaciones, en tu panel.</div>',
  }),

  // 6. Pruébalo.
  '6-pruebalo': pagina({
    eyebrow: 'Pruébalo tú',
    titulo: 'Escríbele como si fueras <em>un cliente</em>.',
    contenido:
      '<div class="tarjetas">' +
      [
        ['Peluquería', '623 79 03 43', '«¿Cuánto cuestan unas mechas?»'],
        ['Clínica dental', '613 01 39 79', '«Me duele una muela, ¿me podéis ver?»'],
        ['Fisioterapia', '623 81 47 87', '«Tengo una contractura, ¿tenéis hueco?»'],
      ]
        .map(([s, n, p]) => `<div class="tarjeta"><div class="sector">${s}</div><div class="num">${n}</div><div class="preg">${p}</div></div>`)
        .join('') +
      '</div>' +
      '<div class="texto" style="margin-top:34px">Los negocios son inventados. <b>El asistente es el de verdad.</b> También en agenciakivuk.com/#probar</div>',
  }),
};

// --- fotografiar ------------------------------------------------------------
function navegador() {
  const n = NAVEGADORES.find((r) => fs.existsSync(r));
  if (!n) throw new Error('no encuentro Edge ni Chrome');
  return n;
}

function main() {
  const nav = navegador();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kivuk-posts-'));
  fs.mkdirSync(SALIDA, { recursive: true });

  const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const fallidas = [];

  // Con nombres detrás (`node ... 1-quien-soy-2`), solo esas; sin nada, todas.
  const pedidas = process.argv.slice(2);
  const lista = Object.entries(DIAPOSITIVAS).filter(([n]) => !pedidas.length || pedidas.includes(n));
  if (!lista.length) throw new Error(`no hay ninguna diapositiva llamada ${pedidas.join(', ')}`);

  for (const [nombre, html] of lista) {
    const htmlRuta = path.join(tmp, `${nombre}.html`);
    const png = path.join(SALIDA, `${nombre}.png`);
    fs.writeFileSync(htmlRuta, html);
    // Se borra antes para que «existe» signifique «es la de ahora».
    fs.rmSync(png, { force: true });
    execFileSync(nav, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${W},${H}`,
      // Da tiempo a que llegue Poppins de Google Fonts antes de la foto.
      '--virtual-time-budget=10000',
      // Un perfil por imagen: con uno compartido, la segunda llamada puede
      // engancharse al proceso de la primera y volver sin hacer nada.
      `--user-data-dir=${path.join(tmp, 'perfil-' + nombre)}`,
      `--screenshot=${png}`,
      'file:///' + htmlRuta.replace(/\\/g, '/'),
    ], { stdio: 'ignore' });

    // Que el navegador haya vuelto no quiere decir que la imagen esté escrita.
    for (let i = 0; i < 40 && !fs.existsSync(png); i++) esperar(500);
    if (fs.existsSync(png)) console.log('✓', path.relative(RAIZ, png));
    else { console.log('✖', path.relative(RAIZ, png), '— no se ha escrito'); fallidas.push(nombre); }
  }
  // Edge tarda en soltar su perfil temporal y borrarlo al instante falla con
  // EBUSY en Windows. Las imágenes ya están escritas: se reintenta y, si sigue
  // ocupado, se dice dónde ha quedado en vez de romper al final.
  try {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    console.log(`(queda una carpeta temporal por borrar: ${tmp})`);
  }
  if (fallidas.length) {
    console.error(`\nFaltan ${fallidas.length}: ${fallidas.join(', ')}. Cierra el navegador y vuelve a lanzarlo.`);
    process.exitCode = 1;
  }
}

main();
