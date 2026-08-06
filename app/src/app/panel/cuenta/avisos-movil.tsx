"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  olvidarDispositivo,
  registrarDispositivo,
  dispositivoRegistrado,
} from "./push";

/**
 * Avisos en el móvil, con la app cerrada.
 *
 * Es el único aviso por dispositivo y no por negocio: el permiso lo da este
 * teléfono concreto, y el navegador emite una suscripción que solo sirve para
 * él. De ahí que la interfaz no sea una casilla de «sí/no» sino «este
 * dispositivo recibe avisos», con su botón para quitarlo.
 *
 * En iPhone hay una condición extra que no se puede evitar: Safari solo permite
 * notificaciones si la web está **instalada** en la pantalla de inicio. Abierta
 * como una página normal, ni siquiera deja pedir el permiso.
 */

/**
 * La clave VAPID viaja en base64url y el navegador la quiere en bytes.
 *
 * Se construye el `ArrayBuffer` primero y se rellena después, en vez de usar
 * `Uint8Array.from`: los tipos de TypeScript admiten que un Uint8Array esté
 * respaldado por un `SharedArrayBuffer`, que `applicationServerKey` no acepta.
 */
function aBytes(base64url: string): ArrayBuffer {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(base64);

  const buffer = new ArrayBuffer(crudo.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);

  return buffer;
}

type Estado =
  | "comprobando"
  | "no-soportado"
  | "hace-falta-instalar"
  | "bloqueado"
  | "activo"
  | "inactivo";

export function AvisosMovil({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("comprobando");
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const soporta =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone ===
          true;

      if (!soporta) {
        if (!cancelado) setEstado(esIos && !instalada ? "hace-falta-instalar" : "no-soportado");
        return;
      }

      if (esIos && !instalada) {
        if (!cancelado) setEstado("hace-falta-instalar");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelado) setEstado("bloqueado");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();

      // Que el navegador tenga suscripción no basta: puede haber quedado de
      // otra sesión o de otro cliente. Manda lo que hay guardado en la base.
      const registrado = suscripcion
        ? await dispositivoRegistrado(suscripcion.endpoint)
        : false;

      if (!cancelado) setEstado(registrado ? "activo" : "inactivo");
    })().catch(() => {
      if (!cancelado) setEstado("no-soportado");
    });

    return () => {
      cancelado = true;
    };
  }, []);

  function activar() {
    setError(null);

    empezar(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setEstado(permiso === "denied" ? "bloqueado" : "inactivo");
          return;
        }

        const registro = await navigator.serviceWorker.ready;

        // Si ya había una suscripción de antes se reutiliza; volver a
        // suscribirse con otra clave daría error.
        const suscripcion =
          (await registro.pushManager.getSubscription()) ??
          (await registro.pushManager.subscribe({
            // Obligatorio en la práctica: los navegadores rechazan las
            // suscripciones que no van asociadas a una interacción visible.
            userVisibleOnly: true,
            applicationServerKey: aBytes(clavePublica),
          }));

        const datos = suscripcion.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };

        const r = await registrarDispositivo(
          { endpoint: datos.endpoint, keys: datos.keys },
          navigator.userAgent
        );

        if (!r.ok) {
          setError(r.mensaje ?? "No se pudo activar.");
          return;
        }
        setEstado("activo");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo activar.");
      }
    });
  }

  function desactivar() {
    setError(null);

    empezar(async () => {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();

      if (suscripcion) {
        await olvidarDispositivo(suscripcion.endpoint);
        await suscripcion.unsubscribe();
      }
      setEstado("inactivo");
    });
  }

  const marco =
    "flex items-start gap-3 rounded-lg border p-3 text-sm";

  if (estado === "comprobando") {
    return (
      <div className={`${marco} text-muted-foreground`}>
        <Smartphone className="mt-0.5 size-4 shrink-0" />
        Comprobando este dispositivo…
      </div>
    );
  }

  if (estado === "hace-falta-instalar") {
    return (
      <div className={marco}>
        <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <span className="font-medium">Instálala antes en tu pantalla de inicio</span>
          <span className="text-muted-foreground">
            En el iPhone, las notificaciones solo funcionan con la app instalada.
            Pulsa <strong>Compartir</strong> y luego{" "}
            <strong>Añadir a pantalla de inicio</strong>; después vuelve aquí.
          </span>
        </div>
      </div>
    );
  }

  if (estado === "no-soportado") {
    return (
      <div className={`${marco} text-muted-foreground`}>
        <Smartphone className="mt-0.5 size-4 shrink-0" />
        Este navegador no admite notificaciones. Prueba desde Chrome en Android o
        con la app instalada en el iPhone.
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className={marco}>
        <BellRing className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <span className="font-medium">Has bloqueado las notificaciones</span>
          <span className="text-muted-foreground">
            El navegador ya no vuelve a preguntar. Hay que permitirlas a mano en
            los ajustes del sitio (el candado junto a la dirección) y recargar.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={marco}>
        {estado === "activo" ? (
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        ) : (
          <BellRing className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              {estado === "activo"
                ? "Este dispositivo recibe avisos"
                : "Avisos en este dispositivo"}
            </span>
            <span className="text-muted-foreground">
              {estado === "activo"
                ? "Te llegará una notificación aunque tengas la app cerrada. Se activa en cada móvil por separado."
                : "Una notificación en el teléfono cuando alguien pida hablar con una persona, aunque no tengas la app abierta."}
            </span>
          </div>

          <div>
            {estado === "activo" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pendiente}
                onClick={desactivar}
              >
                Dejar de recibirlos aquí
              </Button>
            ) : (
              <Button size="sm" disabled={pendiente} onClick={activar}>
                <BellRing className="size-4" />
                {pendiente ? "Activando…" : "Activar en este móvil"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
