"use client";

import { useEffect } from "react";

/** Si esta ventana es la app instalada y no una pestaña del navegador. */
function enModoApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iOS no implementa display-mode y usa esto.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Registra el service worker del panel.
 *
 * Solo en `/panel`: el `scope` limita lo que el service worker puede
 * interceptar, y el panel de la agencia no tiene por qué pasar por él.
 *
 * No pinta nada ni bloquea nada. Si el navegador no lo soporta —o si se está
 * abriendo por http en local, donde no se permite— simplemente no se registra y
 * la web funciona igual: la PWA añade cosas, no es un requisito para usarla.
 */
export function RegistrarPwa() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // El service worker pregunta esto al pulsar una notificación, para decidir
    // si enfoca esta ventana o abre la app. Antes solo se lo decíamos al
    // cargar la página, y él lo guardaba en memoria — memoria que Android borra
    // cada vez que para el service worker, o sea, justo antes de necesitarla.
    // Contestando en el momento da igual cuántas veces lo hayan matado.
    const responder = (evento: MessageEvent) => {
      if (evento.data?.tipo === "¿eres-la-app?" && evento.ports?.[0]) {
        evento.ports[0].postMessage(enModoApp());
      }
    };

    navigator.serviceWorker.addEventListener("message", responder);

    navigator.serviceWorker
      .register("/panel-sw.js", { scope: "/panel" })
      .then(() => {
        // Vía rápida: avisar de una vez de que esto es la app, para que no
        // tenga ni que preguntar si la lista sigue viva cuando llegue el aviso.
        if (!enModoApp()) return;

        // `controller` es null en la primera carga tras instalar el service
        // worker: todavía no controla esta página. `ready` espera a que lo haga.
        navigator.serviceWorker.ready.then(() => {
          navigator.serviceWorker.controller?.postMessage({ tipo: "soy-la-app" });
        });
      })
      .catch(() => {
        // Sin service worker no hay instalación ni notificaciones, pero el
        // panel se usa igual desde el navegador. No merece molestar al usuario.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("message", responder);
    };
  }, []);

  return null;
}
