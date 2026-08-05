"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Bot, Clock, Send, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  devolverAlBot,
  enviarMensaje,
  marcarLeida,
  tomarElMando,
} from "./acciones";
import {
  etiquetaContacto,
  tiempoRestanteVentana,
  ventanaAbierta,
  type ConversacionResumen,
  type MensajeBandeja,
} from "./tipos";

/** Un mensaje suelto. El color dice quién habla sin necesidad de etiqueta. */
function Burbuja({ mensaje }: { mensaje: MensajeBandeja }) {
  const esContacto = mensaje.quien === "contact";

  return (
    <div
      className={cn(
        "flex w-full",
        esContacto ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm md:max-w-[65%]",
          esContacto
            ? "rounded-bl-sm bg-card"
            : mensaje.quien === "human"
              ? "rounded-br-sm bg-[var(--kivuk-azul-hondo)] text-white"
              : "rounded-br-sm bg-[#dcf8c6] text-[#1f2c33] dark:bg-[#2f5b46] dark:text-[#e7ecef]",
          mensaje.enviando && "opacity-60"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            esContacto || mensaje.quien === "bot"
              ? "text-muted-foreground"
              : "text-white/70"
          )}
        >
          {mensaje.quien === "bot" && <Bot className="size-3" />}
          {mensaje.quien === "human" && <UserRound className="size-3" />}
          <span>
            {mensaje.enviando
              ? "enviando…"
              : new Date(mensaje.fecha).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
          </span>
        </div>
        {mensaje.fallo && (
          <p className="mt-1 text-[11px] text-destructive">{mensaje.fallo}</p>
        )}
      </div>
    </div>
  );
}

/** Separador de día, como en WhatsApp. */
function esOtroDia(a: string, b: string) {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

function etiquetaDia(fecha: string) {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === hoy.getFullYear() ? undefined : "numeric",
  });
}

export function Hilo({
  conversacion,
  onVolver,
}: {
  conversacion: ConversacionResumen;
  onVolver: () => void;
}) {
  const [mensajes, setMensajes] = useState<MensajeBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  // Los mensajes se piden desde el navegador, no desde el servidor: así abrir
  // una conversación no recarga la página y el hilo puede quedarse escuchando
  // los mensajes nuevos.
  //
  // No hace falta vaciar el estado al cambiar de conversación porque el padre
  // monta este componente con `key={id}`: al cambiar, React lo desmonta y lo
  // vuelve a crear vacío. Es lo que evita el parpadeo de ver un instante los
  // mensajes de la conversación anterior.
  useEffect(() => {
    const supabase = createClient();
    let cancelado = false;

    supabase
      .from("messages")
      .select("id, content, sender, created_at")
      .eq("conversation_id", conversacion.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelado) return;
        setMensajes(
          (data ?? []).map((m) => ({
            id: m.id,
            contenido: m.content,
            quien: m.sender as MensajeBandeja["quien"],
            fecha: m.created_at,
          }))
        );
        setCargando(false);
      });

    const canal = supabase
      .channel(`mensajes-${conversacion.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversacion.id}`,
        },
        (payload) => {
          const m = payload.new as {
            id: string;
            content: string;
            sender: string;
            created_at: string;
          };
          setMensajes((previos) => {
            if (previos.some((p) => p.id === m.id)) return previos;
            // Al llegar el de verdad se retira el optimista con el mismo texto.
            const sinOptimista = previos.filter(
              (p) => !(p.enviando && p.contenido === m.content)
            );
            return [
              ...sinOptimista,
              {
                id: m.id,
                contenido: m.content,
                quien: m.sender as MensajeBandeja["quien"],
                fecha: m.created_at,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(canal);
    };
  }, [conversacion.id]);

  // Al abrir una conversación con mensajes sin leer, se da por leída.
  useEffect(() => {
    if (conversacion.sinLeer > 0) {
      marcarLeida(conversacion.id);
    }
  }, [conversacion.id, conversacion.sinLeer]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const abierta = ventanaAbierta(conversacion.ultimoEntrante);
  const alMando = conversacion.modo === "human";
  const puedeEscribir = alMando && abierta;

  function enviar() {
    const contenido = texto.trim();
    if (!contenido || pendiente) return;

    const optimista: MensajeBandeja = {
      id: `pendiente-${Date.now()}`,
      contenido,
      quien: "human",
      fecha: new Date().toISOString(),
      enviando: true,
    };

    setMensajes((p) => [...p, optimista]);
    setTexto("");
    setError(null);

    empezar(async () => {
      const r = await enviarMensaje(conversacion.id, contenido);

      setMensajes((p) => {
        // Con el id de verdad, la burbuja provisional pasa a ser la definitiva
        // sin esperar a Realtime — y si Realtime la trae después, se descarta
        // sola por id repetido. Sin esto, un fallo de la suscripción dejaba el
        // mensaje eternamente en «enviando…» aunque hubiera llegado.
        if (r.ok && r.id) {
          return p.map((m) =>
            m.id === optimista.id ? { ...m, id: r.id!, enviando: false } : m
          );
        }
        if (r.ok) return p;
        return p.map((m) =>
          m.id === optimista.id
            ? { ...m, enviando: false, fallo: "No se envió" }
            : m
        );
      });

      if (!r.ok) setError(r.mensaje ?? "No se pudo enviar.");
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onVolver}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {etiquetaContacto(conversacion)}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {alMando ? (
              <>
                <UserRound className="size-3" />
                Estás respondiendo tú
              </>
            ) : (
              <>
                <Bot className="size-3" />
                Responde el asistente
              </>
            )}
          </p>
        </div>
        {alMando ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => devolverAlBot(conversacion.id)}
          >
            <Bot className="size-4" />
            Devolver al asistente
          </Button>
        ) : (
          <Button size="sm" onClick={() => tomarElMando(conversacion.id)}>
            <UserRound className="size-4" />
            Responder yo
          </Button>
        )}
      </header>

      {conversacion.pidioPersona && !alMando && (
        <div className="shrink-0 border-b bg-[var(--kivuk-terracota)]/10 px-4 py-2 text-sm text-[var(--kivuk-terracota)]">
          Ha pedido hablar con una persona.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-4 py-4">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : mensajes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta conversación todavía no tiene mensajes.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mensajes.map((m, i) => (
              <div key={m.id} className="flex flex-col gap-2">
                {(i === 0 || esOtroDia(mensajes[i - 1].fecha, m.fecha)) && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
                      {etiquetaDia(m.fecha)}
                    </span>
                  </div>
                )}
                <Burbuja mensaje={m} />
              </div>
            ))}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t bg-card p-3">
        {!abierta ? (
          <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <p>
              Han pasado más de 24 horas desde su último mensaje. WhatsApp solo
              permite escribir libremente dentro de ese plazo: hasta que vuelva
              a escribir, no se le puede responder por aquí.
            </p>
          </div>
        ) : !alMando ? (
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            El asistente está atendiendo esta conversación. Pulsa{" "}
            <span className="font-medium">Responder yo</span> para escribir tú;
            mientras tanto, el asistente se queda callado.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  // Enter envía, Mayús+Enter hace párrafo: como en WhatsApp Web.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                rows={1}
                placeholder="Escribe un mensaje…"
                className="max-h-32 min-h-10 flex-1 resize-y rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button
                size="icon"
                className="size-10 shrink-0 rounded-full"
                disabled={!puedeEscribir || !texto.trim() || pendiente}
                onClick={enviar}
              >
                <Send className="size-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Quedan {tiempoRestanteVentana(conversacion.ultimoEntrante)} para
                responder.
              </span>
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
