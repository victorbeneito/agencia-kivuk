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

const CACHE = "kivuk-panel-v1";

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
  const esEstatico =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest");

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

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/panel";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si la app ya está abierta se reutiliza esa ventana; abrir una segunda
      // deja al usuario con dos copias de lo mismo.
      for (const ventana of ventanas) {
        if (ventana.url.includes("/panel") && "focus" in ventana) {
          ventana.navigate(destino);
          return ventana.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
