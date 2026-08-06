"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Hilo } from "./hilo";
import {
  COLUMNAS_CONVERSACION,
  desdeFila,
  etiquetaContacto,
  type ConversacionResumen,
} from "./tipos";

/**
 * Bandeja de conversaciones, en dos columnas como WhatsApp Web.
 *
 * El mismo componente lo usan el panel del cliente y el de la agencia: es
 * exactamente el mismo trabajo, y tener dos copias garantizaba que una se
 * quedase atrás. En móvil las dos columnas se turnan — lista, y al entrar en un
 * hilo, el hilo a pantalla completa — que es como se va a usar cuando esto sea
 * una PWA.
 *
 * La lista llega ya cargada desde el servidor y a partir de ahí se mantiene
 * sola por realtime: no hace falta recargar para ver un mensaje nuevo.
 */
function horaCorta(fecha: string | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  const hoy = new Date();

  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "Ayer";

  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

export function Bandeja({
  clientId,
  conversacionesIniciales,
}: {
  clientId: string;
  conversacionesIniciales: ConversacionResumen[];
}) {
  // Dos fuentes que se pisarían si se copiara una sobre otra: la lista que
  // renderiza el servidor (y que se refresca cuando una server action revalida
  // la ruta) y lo que llega por realtime. En vez de volcar los props en el
  // estado, se guardan solo los cambios recibidos y se mezclan al pintar: así
  // ninguna de las dos borra a la otra.
  const [cambios, setCambios] = useState<Record<string, ConversacionResumen>>({});
  const [activaId, setActivaId] = useState<string | null>(null);
  const esMovil = useIsMobile();

  const conversaciones = useMemo(() => {
    const porId = new Map(conversacionesIniciales.map((c) => [c.id, c]));
    for (const [id, c] of Object.entries(cambios)) porId.set(id, c);

    return [...porId.values()].sort(
      (a, b) =>
        new Date(b.ultimoMensaje ?? 0).getTime() -
        new Date(a.ultimoMensaje ?? 0).getTime()
    );
  }, [conversacionesIniciales, cambios]);

  useEffect(() => {
    const supabase = createClient();

    const canal = supabase
      .channel(`conversaciones-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `client_id=eq.${clientId}`,
        },
        async (payload) => {
          // El payload de realtime trae la fila cruda; se vuelve a pedir por
          // id para no depender de que traiga todas las columnas (con REPLICA
          // IDENTITY por defecto, un UPDATE no las trae completas).
          const id = (payload.new as { id?: string })?.id;
          if (!id) return;

          const { data } = await supabase
            .from("conversations")
            .select(COLUMNAS_CONVERSACION)
            .eq("id", id)
            .maybeSingle();

          if (!data) return;
          const conversacion = desdeFila(data as never);

          setCambios((previos) => ({
            ...previos,
            [conversacion.id]: conversacion,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [clientId]);

  // En escritorio se abre sola la primera conversación, porque una columna
  // vacía al lado de la lista no aporta nada. En móvil no: la lista ocupa toda
  // la pantalla y entrar directamente en un hilo dejaría al usuario dentro de
  // una conversación que no ha elegido, teniendo que salir para ver el resto.
  const abierta = activaId ?? (esMovil ? null : conversaciones[0]?.id ?? null);

  const activa = useMemo(
    () => conversaciones.find((c) => c.id === abierta) ?? null,
    [conversaciones, abierta]
  );

  if (conversaciones.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
        <MessageSquare className="size-8 text-muted-foreground" />
        <p className="font-medium">Todavía no hay conversaciones</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Aquí aparecerá cada persona que escriba por WhatsApp, con todo el
          historial y la posibilidad de contestar tú en cualquier momento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 md:overflow-hidden">
      <aside
        className={cn(
          "flex w-full min-w-0 flex-col border-r bg-card md:w-80 md:shrink-0",
          // En móvil, lista y conversación se turnan la pantalla.
          abierta ? "hidden md:flex" : "flex"
        )}
      >
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {conversaciones.map((c) => {
            const seleccionada = c.id === abierta;

            return (
              <li key={c.id}>
                <button
                  onClick={() => setActivaId(c.id)}
                  // Filas altas y cómodas: esta lista se recorre con el pulgar
                  // y en marcha. Apretar las filas para que quepan más solo
                  // sirve para pulsar la equivocada.
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/60",
                    seleccionada && "md:bg-accent"
                  )}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="size-6" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-base font-medium md:text-[15px]">
                        {etiquetaContacto(c)}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          c.sinLeer > 0
                            ? "font-medium text-[var(--kivuk-terracota)]"
                            : "text-muted-foreground"
                        )}
                      >
                        {horaCorta(c.ultimoMensaje)}
                      </span>
                    </span>

                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[15px] md:text-sm",
                          c.sinLeer > 0
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {c.avance ?? "—"}
                      </span>
                      {c.sinLeer > 0 && (
                        <span className="flex min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--kivuk-terracota)] px-1.5 py-0.5 text-xs font-medium text-white">
                          {c.sinLeer}
                        </span>
                      )}
                    </span>

                    {(c.pidioPersona || c.modo === "human") && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {c.pidioPersona && c.modo !== "human" && (
                          <span className="rounded-full bg-[var(--kivuk-terracota)]/15 px-2 py-0.5 text-xs text-[var(--kivuk-terracota)]">
                            Pide una persona
                          </span>
                        )}
                        {c.modo === "human" && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            Al mando tú
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1",
          // En móvil el hilo se come la pantalla entera —cabecera del panel y
          // barra de navegación incluidas— como hace WhatsApp al abrir un chat.
          // Con la navegación abajo, el cuadro de escribir se quedaba encima de
          // ella y no había sitio para nada.
          abierta
            ? "fixed inset-0 z-50 flex flex-col bg-background md:static md:z-auto"
            : "hidden md:flex md:flex-col"
        )}
      >
        {activa ? (
          // La `key` es intencionada: al cambiar de conversación se monta un
          // hilo nuevo en vez de reutilizar el anterior, así no se ven un
          // instante los mensajes del chat que se acaba de dejar.
          <Hilo
            key={activa.id}
            conversacion={activa}
            onVolver={() => setActivaId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
            Elige una conversación para leerla.
          </div>
        )}
      </section>
    </div>
  );
}
