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
      .catch(() => {
        // Sin service worker no hay instalación ni notificaciones, pero el
        // panel se usa igual desde el navegador. No merece molestar al usuario.
      });
  }, []);

  return null;
}
