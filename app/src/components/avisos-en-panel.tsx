"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * El aviso de «hay algo nuevo» mientras el panel está abierto.
 *
 * No pinta nada: vive en el layout y solo toca dos cosas que se notan sin estar
 * mirando la pestaña —el título del navegador y un sonido corto—. Es el escalón
 * más barato de los tres avisos posibles (panel, correo, móvil) y el único que
 * no depende de configurar nada por fuera.
 */
function pitido() {
  try {
    type ConAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx =
      window.AudioContext ?? (window as ConAudio).webkitAudioContext;
    if (!Ctx) return;

    // Se sintetiza en vez de cargar un mp3: dos tonos cortos no merecen un
    // archivo binario en el repo ni una petición más al cargar el panel.
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);

    // Entrada y salida suaves: un tono que empieza y acaba en seco suena a
    // click roto en algunos altavoces.
    vol.gain.setValueAtTime(0.0001, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);

    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
    osc.onended = () => ctx.close();
  } catch {
    // Si el navegador no deja sonar (hace falta que el usuario haya
    // interactuado con la página), el contador del título sigue avisando. No
    // merece romper nada.
  }
}

export function AvisosEnPanel({
  clientId,
  activo,
  sinLeerInicial,
  tituloBase,
}: {
  clientId: string;
  activo: boolean;
  sinLeerInicial: number;
  tituloBase: string;
}) {
  const [sinLeer, setSinLeer] = useState(sinLeerInicial);
  const anterior = useRef(sinLeerInicial);

  useEffect(() => {
    if (!activo) return;

    const supabase = createClient();

    const canal = supabase
      .channel(`avisos-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `client_id=eq.${clientId}`,
        },
        async () => {
          // Se recuenta en vez de fiarse del payload: con la REPLICA IDENTITY
          // por defecto, un UPDATE no trae la fila anterior, así que no hay
          // forma de saber desde el evento si el contador subió o bajó.
          const { data } = await supabase
            .from("conversations")
            .select("unread_count")
            .eq("client_id", clientId);

          const total = (data ?? []).reduce(
            (t, c) => t + (c.unread_count ?? 0),
            0
          );

          // Solo suena cuando sube. Marcar una conversación como leída también
          // dispara el evento, y sonar al leer sería absurdo.
          if (total > anterior.current) pitido();
          anterior.current = total;
          setSinLeer(total);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [clientId, activo]);

  useEffect(() => {
    document.title = sinLeer > 0 ? `(${sinLeer}) ${tituloBase}` : tituloBase;
  }, [sinLeer, tituloBase]);

  return null;
}
