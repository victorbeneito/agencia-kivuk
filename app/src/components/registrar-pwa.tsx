"use client";

import { useEffect } from "react";

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

    navigator.serviceWorker
      .register("/panel-sw.js", { scope: "/panel" })
      .then(() => {
        // Si esto es la app instalada y no una pestaña, decírselo al service
        // worker: es lo único que le permite distinguirlas, y lo necesita para
        // que al pulsar una notificación se abra la app y no el navegador.
        const enLaApp =
          window.matchMedia("(display-mode: standalone)").matches ||
          // Safari en iOS no implementa display-mode y usa esto.
          (window.navigator as { standalone?: boolean }).standalone === true;

        if (!enLaApp) return;

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
  }, []);

  return null;
}
