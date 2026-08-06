"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share, SmartphoneCharging } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * «Instálate esto en el móvil».
 *
 * Nadie que no sea del oficio sabe que una web se puede instalar, y menos por
 * dónde. Sin este empujón, la PWA existe pero no la usa nadie — y en iOS, además,
 * las notificaciones **solo** funcionan si la app está instalada en la pantalla
 * de inicio, así que dejarlo al azar es dejar el aviso al azar.
 *
 * Los dos sistemas se instalan de forma distinta y hay que tratarlos aparte:
 * Android deja pedirlo por código, Safari no y hay que explicar el gesto.
 */
type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Si ya está instalada, se abre en modo «standalone» y no hay nada que ofrecer.
 * `navigator.standalone` es el equivalente en Safari, que no implementa
 * display-mode.
 */
function leerInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function suscribirInstalada(avisar: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", avisar);
  window.addEventListener("appinstalled", avisar);
  return () => {
    mq.removeEventListener("change", avisar);
    window.removeEventListener("appinstalled", avisar);
  };
}

// Estas dos preguntas solo tienen respuesta en el navegador, así que en el
// servidor se contesta lo que no enseña nada y ya se corrige al hidratar. Van
// por `useSyncExternalStore` y no por un efecto que llame a setState: es lo que
// React pide para leer cosas de fuera de React sin provocar un renderizado en
// cascada.
const noHayASuscribirse = () => () => {};

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [instaladaAhora, setInstaladaAhora] = useState(false);

  const instalada =
    useSyncExternalStore(suscribirInstalada, leerInstalada, () => true) ||
    instaladaAhora;

  const esIos = useSyncExternalStore(
    noHayASuscribirse,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false
  );

  useEffect(() => {
    const alPoder = (e: Event) => {
      // Sin esto Chrome enseña su propia barra, que sale abajo, tapa cosas y no
      // explica para qué sirve instalarlo.
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    };

    window.addEventListener("beforeinstallprompt", alPoder);
    return () => window.removeEventListener("beforeinstallprompt", alPoder);
  }, []);

  if (instalada) return null;

  // Safari no permite lanzar la instalación por código: solo queda explicar el
  // gesto, que además está escondido detrás del botón de compartir.
  if (esIos) {
    return (
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Share className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Ponla en tu pantalla de inicio</p>
          <p className="text-sm text-muted-foreground">
            Desde Safari, pulsa el botón de <strong>Compartir</strong> (el
            cuadrado con la flecha) y elige{" "}
            <strong>Añadir a pantalla de inicio</strong>. Se abrirá como una app,
            sin la barra del navegador.
          </p>
        </div>
      </div>
    );
  }

  if (!evento) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <SmartphoneCharging className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="flex flex-col items-start gap-2">
        <div>
          <p className="text-sm font-medium">Instálala en tu móvil</p>
          <p className="text-sm text-muted-foreground">
            Se abre como una app, a pantalla completa y con su icono. Es la misma
            de siempre: no ocupa casi nada.
          </p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            await evento.prompt();
            const { outcome } = await evento.userChoice;
            if (outcome === "accepted") setInstaladaAhora(true);
            // El evento solo se puede usar una vez.
            setEvento(null);
          }}
        >
          Instalar
        </Button>
      </div>
    </div>
  );
}
