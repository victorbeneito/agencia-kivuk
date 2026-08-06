"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * El aviso de «hay algo nuevo» mientras el panel está abierto.
 *
 * Tres formas de enterarse, a propósito, porque cada una falla en un momento
 * distinto: un cartel en pantalla (si estás mirando el panel), el contador en el
 * título de la pestaña (si estás en otra pestaña) y un sonido (si no estás
 * mirando nada). La primera versión solo tenía las dos últimas y no servía para
 * el caso más normal —tener el panel delante—, además de que el sonido se lo
 * come la política de autoplay del navegador.
 */

/** Un solo AudioContext para toda la sesión, creado en cuanto se pueda. */
let audio: AudioContext | null = null;

function contextoDeAudio(): AudioContext | null {
  try {
    type ConAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? (window as ConAudio).webkitAudioContext;
    if (!Ctx) return null;

    if (!audio) audio = new Ctx();

    // Chrome crea el contexto «suspendido» si la página aún no ha recibido una
    // interacción, y en ese estado suena el silencio sin dar ningún error. De
    // ahí que se intente reanudar cada vez y que se prepare al primer clic.
    if (audio.state === "suspended") void audio.resume();

    return audio;
  } catch {
    return null;
  }
}

export function pitido() {
  const ctx = contextoDeAudio();
  if (!ctx) return;

  try {
    // Se sintetiza en vez de cargar un mp3: dos tonos cortos no merecen un
    // archivo binario en el repo ni una petición más al cargar el panel.
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
  } catch {
    // Si el navegador no deja sonar, el cartel y el contador siguen avisando.
  }
}

type Aviso = {
  id: number;
  texto: string;
  quien: string;
  urgente: boolean;
};

export function AvisosEnPanel({
  clientId,
  activo,
  sinLeerInicial,
  esperandoInicial,
  ultimoEntranteInicial,
  tituloBase,
}: {
  clientId: string;
  activo: boolean;
  sinLeerInicial: number;
  /** Conversaciones que ya estaban esperando una persona al cargar la página. */
  esperandoInicial: number;
  /** Fecha del último mensaje entrante que ya existía al cargar la página. */
  ultimoEntranteInicial: string;
  tituloBase: string;
}) {
  const [sinLeer, setSinLeer] = useState(sinLeerInicial);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // La foto de partida sale de lo que ya ha contado el servidor al pintar la
  // página. Antes se tomaba en el primer evento que llegaba, y eso se comía el
  // primer aviso de cada sesión: al escribir un contacto llegan dos eventos casi
  // seguidos —el mensaje guardado y el sello de «pide una persona»—, el primero
  // se gastaba en hacer la foto y el segundo ya no veía ningún cambio.
  const anteriorSinLeer = useRef(sinLeerInicial);
  const anteriorEsperando = useRef(esperandoInicial);
  const anteriorEntrante = useRef(ultimoEntranteInicial);

  // Preparar el audio en cuanto el usuario toque algo. Sin esto, el primer
  // aviso de la sesión es siempre mudo.
  useEffect(() => {
    if (!activo) return;
    const preparar = () => contextoDeAudio();
    window.addEventListener("pointerdown", preparar, { once: true });
    window.addEventListener("keydown", preparar, { once: true });
    return () => {
      window.removeEventListener("pointerdown", preparar);
      window.removeEventListener("keydown", preparar);
    };
  }, [activo]);

  const revisar = useCallback(async () => {
    const supabase = createClient();

    // Se recuenta en vez de fiarse del evento: con la REPLICA IDENTITY por
    // defecto, un UPDATE no trae la fila anterior, así que desde el payload no
    // hay forma de saber si el contador ha subido o ha bajado.
    const { data } = await supabase
      .from("conversations")
      .select(
        "unread_count, handoff_requested_at, mode, contact_name, external_contact_id, last_message_at, last_inbound_at"
      )
      .eq("client_id", clientId)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    const filas = data ?? [];

    const total = filas.reduce((t, c) => t + (c.unread_count ?? 0), 0);
    const esperando = filas.filter(
      (c) => c.handoff_requested_at && c.mode !== "human"
    ).length;

    // El disparador de «te han escrito» es la fecha del último mensaje
    // entrante, no el contador de sin leer.
    //
    // El contador se pone a cero en cuanto alguien abre esa conversación en
    // cualquier bandeja —la del cliente o la de la agencia—, así que usarlo
    // para avisar significa no avisar justo cuando hay alguien trabajando. La
    // fecha, en cambio, solo avanza: si es más nueva que la última que vimos,
    // ha llegado algo, lo haya leído quien lo haya leído.
    const ultimoEntrante = filas.reduce(
      (max, c) =>
        c.last_inbound_at && c.last_inbound_at > max ? c.last_inbound_at : max,
      ""
    );

    const reciente = filas[0];
    const quien =
      reciente?.contact_name || reciente?.external_contact_id || "Un contacto";

    const nuevoEscalado = esperando > anteriorEsperando.current;
    const nuevoMensaje =
      Boolean(ultimoEntrante) && ultimoEntrante > anteriorEntrante.current;

    // Estando en la bandeja, un cartel por cada mensaje que llega taparía el
    // cuadro de escribir justo mientras se contesta, y ahí la lista ya se
    // actualiza sola. Lo que sí se sigue avisando es que alguien pida hablar
    // con una persona: eso puede ser de otra conversación que no se está
    // mirando.
    const enLaBandeja = window.location.pathname.startsWith(
      "/panel/conversaciones"
    );

    if (nuevoEscalado || (nuevoMensaje && !enLaBandeja)) {
      setAviso({
        id: Date.now(),
        quien,
        // Que alguien pida hablar con una persona manda sobre «tienes un
        // mensaje»: es lo que hace falta atender ya.
        texto: nuevoEscalado
          ? "ha pedido hablar con una persona"
          : "te ha escrito",
        urgente: nuevoEscalado,
      });
      pitido();
    }

    anteriorEsperando.current = esperando;
    anteriorSinLeer.current = total;
    if (ultimoEntrante) anteriorEntrante.current = ultimoEntrante;
    setSinLeer(total);
  }, [clientId]);

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
        () => {
          void revisar();
        }
      )
      .subscribe();

    // Red de seguridad. Realtime va por websocket, y un websocket se cae: wifi
    // que salta, portátil que se suspende, proxy que corta la conexión inactiva.
    // Cuando eso pasa no hay error visible, simplemente dejan de llegar avisos —
    // que es el peor fallo posible en algo cuyo trabajo es avisar. Una consulta
    // cada medio minuto cuesta nada y lo cubre.
    const reloj = setInterval(() => void revisar(), 30_000);

    // Y al volver a la pestaña, sin esperar al reloj: es justo el momento en el
    // que alguien viene a mirar si ha pasado algo.
    const alVolver = () => {
      if (document.visibilityState === "visible") void revisar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      supabase.removeChannel(canal);
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [clientId, activo, revisar]);

  useEffect(() => {
    document.title = sinLeer > 0 ? `(${sinLeer}) ${tituloBase}` : tituloBase;
  }, [sinLeer, tituloBase]);

  // El cartel se retira solo, pero tarde: si desaparece en tres segundos y
  // estabas escribiendo un correo, no ha servido de nada.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 25_000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:inset-x-auto sm:right-4 sm:justify-end">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg",
          aviso.urgente
            ? "border-[var(--kivuk-terracota)] bg-[var(--kivuk-terracota)] text-white"
            : "bg-card"
        )}
      >
        <span
          className={cn(
            "mt-0.5 rounded-lg p-2",
            aviso.urgente ? "bg-white/20" : "bg-accent text-accent-foreground"
          )}
        >
          {aviso.urgente ? (
            <UserRound className="size-4" />
          ) : (
            <MessageSquare className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <strong className="break-words">{aviso.quien}</strong> {aviso.texto}.
          </p>
          <Link
            href="/panel/conversaciones"
            onClick={() => setAviso(null)}
            className={cn(
              "mt-1 inline-block text-sm font-medium underline underline-offset-2",
              aviso.urgente ? "text-white" : "text-primary"
            )}
          >
            Abrir la conversación
          </Link>
        </div>

        <button
          onClick={() => setAviso(null)}
          aria-label="Cerrar aviso"
          className={cn(
            "rounded-md p-1",
            aviso.urgente ? "hover:bg-white/20" : "hover:bg-muted"
          )}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
