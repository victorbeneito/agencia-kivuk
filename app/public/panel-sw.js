/*
 * Service worker del panel del cliente.
 *
 * Hace deliberadamente poco. Un service worker puede cachear páginas enteras y
 * servirlas sin pasar por el servidor, y aquí eso sería un problema serio: las
 * páginas del panel llevan datos de un negocio concreto y la sesión se puede
 * cerrar o cambiar. Una página cacheada es una conversación de otro cliente
 * esperando a aparecer en la pantalla equivocada.
 *
 * Así que:
 *   - Los archivos estáticos (JS, CSS, iconos) sí se cachean: son públicos y no
 *     cambian sin cambiar de nombre.
 *   - Las páginas van siempre a la red. Si no hay red, se responde con un aviso
 *     honesto en vez de con datos viejos.
 *   - Y se atienden las notificaciones push, que es la otra razón de que esto
 *     exista.
 */

// Al subir el número se borra la caché anterior entera (ver `activate`). Hay que
// subirlo siempre que cambie algo que ya estuviera cacheado.
const CACHE = "kivuk-panel-v2";

// Lo mínimo para que la pantalla de «sin conexión» no dependa de la red.
const BASICOS = ["/icon-192.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(BASICOS)).catch(() => {})
  );
  // Sin esto, una versión nueva se queda esperando a que se cierren todas las
  // pestañas, que en una app instalada puede ser nunca.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  // Estáticos de Next y los iconos: primero la caché, que no cambian.
  //
  // El manifiesto NO entra aquí a propósito. Es de donde el sistema saca cómo se
  // instala la app y a dónde van las notificaciones; servido desde la caché, un
  // cambio ahí no llegaría nunca al móvil.
  const esEstatico =
    url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".png");

  if (esEstatico) {
    evento.respondWith(
      caches.match(peticion).then(
        (guardado) =>
          guardado ||
          fetch(peticion).then((respuesta) => {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put(peticion, copia));
            return respuesta;
          })
      )
    );
    return;
  }

  // Páginas: siempre a la red. Nunca se sirve una página del panel desde la
  // caché, por lo dicho arriba.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion).catch(
        () =>
          new Response(
            `<!doctype html><meta charset="utf-8">
             <meta name="viewport" content="width=device-width,initial-scale=1">
             <title>Sin conexión</title>
             <style>
               body{font-family:system-ui,sans-serif;background:#f8f8f5;color:#3a3a3a;
                    display:flex;min-height:100vh;align-items:center;justify-content:center;
                    margin:0;padding:24px;text-align:center}
               p{max-width:22rem;line-height:1.5}
             </style>
             <p><strong>Sin conexión.</strong><br>
                Vuelve a intentarlo cuando tengas cobertura: tus conversaciones
                están a salvo, solo hace falta red para verlas.</p>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
      )
    );
  }
});

/*
 * === Notificaciones push ===
 * El servidor manda un JSON con { titulo, cuerpo, url }. Todavía no hay nada
 * enviando: esto queda listo para cuando se active.
 */
self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : "" };
  }

  const titulo = datos.titulo || "Kivuk";

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Que dos avisos de la misma conversación no se apilen en tres líneas.
      tag: datos.tag || "kivuk-aviso",
      renotify: true,
      data: { url: datos.url || "/panel/conversaciones" },
    })
  );
});

/*
 * Qué ventanas son la app instalada y cuáles una pestaña del navegador.
 *
 * La API de service workers no lo dice: un `WindowClient` es igual en los dos
 * casos. Así que lo cuenta la propia página al cargarse (ver `registrar-pwa`),
 * y aquí se apunta su id. Sirve para que, con el panel abierto a la vez en una
 * pestaña y en la app, la notificación lleve a la app.
 *
 * Es una pista, no un registro fiable: el navegador puede parar el service
 * worker cuando le convenga y esto se vacía. Por eso nunca se depende de ello
 * para decidir, solo para ordenar los candidatos.
 */
const VENTANAS_APP = new Set();

self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.tipo === "soy-la-app" && evento.source) {
    VENTANAS_APP.add(evento.source.id);
  }
});

/**
 * Le pregunta a una ventana si es la app instalada, y espera su respuesta.
 *
 * Es lo que sustituye a fiarse de `VENTANAS_APP`: esa lista se pierde cada vez
 * que Android para el service worker, que es precisamente lo que ha pasado
 * cuando llega una notificación con el móvil dormido. Las ventanas, en cambio,
 * siguen ahí y saben perfectamente si están en modo app o en una pestaña.
 *
 * El plazo es corto a propósito. Una página en segundo plano puede estar
 * congelada y no contestar nunca, y más vale enfocar la ventana equivocada que
 * dejar la notificación sin hacer nada mientras el usuario mira el móvil.
 */
function preguntarSiEsApp(cliente) {
  return new Promise((resolve) => {
    let resuelto = false;
    const terminar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      resolve(valor);
    };

    const plazo = setTimeout(() => terminar(false), 400);

    try {
      const canal = new MessageChannel();
      canal.port1.onmessage = (respuesta) => {
        clearTimeout(plazo);
        if (respuesta.data === true) VENTANAS_APP.add(cliente.id);
        terminar(respuesta.data === true);
      };
      cliente.postMessage({ tipo: "¿eres-la-app?" }, [canal.port2]);
    } catch {
      clearTimeout(plazo);
      terminar(false);
    }
  });
}

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(
    (evento.notification.data && evento.notification.data.url) || "/panel",
    self.location.origin
  ).href;

  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Solo las del panel: si el usuario tiene abierta otra parte del sitio,
      // no es sitio al que llevarle desde un aviso de una conversación.
      const alcance = self.registration.scope;
      const candidatas = ventanas.filter(
        (v) => v.url.startsWith(alcance) && "focus" in v
      );

      // La app antes que una pestaña suelta, si sabemos cuál es cuál.
      //
      // Primero la vía rápida: lo que nos dijeron al cargarse. Casi nunca sirve
      // —Android mata el service worker entre aviso y aviso y esto se vacía justo
      // cuando hace falta—, pero cuando sirve, ahorra el ida y vuelta.
      let elegida = candidatas.find((v) => VENTANAS_APP.has(v.id));

      // Y si no, se les pregunta ahora. Recordar no funciona; preguntar sí,
      // porque las ventanas siguen vivas aunque nosotros hayamos muerto.
      if (!elegida) {
        const respuestas = await Promise.all(candidatas.map(preguntarSiEsApp));
        elegida = candidatas.find((_, i) => respuestas[i]);
      }

      // Ninguna se ha identificado: o son pestañas, o estaban congeladas y no
      // han contestado a tiempo. Enfocar una es mejor que no hacer nada.
      elegida = elegida || candidatas[0];

      if (elegida) {
        // `navigate` falla si la ventana no la controla este service worker.
        // Da igual: enfocarla ya deja al usuario donde quería estar.
        try {
          await elegida.navigate(destino);
        } catch {}
        return elegida.focus();
      }

      // Nada abierto. Aquí decide el navegador si esto se abre en la app
      // instalada o en una pestaña, y lo que le inclina hacia la app es el
      // manifiesto: `id`, `scope` y `launch_handler`. Ver panel.webmanifest.
      return self.clients.openWindow(destino);
    })()
  );
});
