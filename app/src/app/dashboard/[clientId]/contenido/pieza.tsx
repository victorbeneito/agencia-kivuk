"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { AlertTriangle, Check, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  aprobarPieza,
  descartarPieza,
  devolverAPendiente,
  guardarTexto,
  publicarPieza,
  type EstadoPieza,
  type ResultadoPublicar,
} from "./actions";

export type PiezaData = {
  id: string;
  status: EstadoPieza;
  format: string;
  caption: string;
  mediaUrl: string;
  titular: string;
  producto: string;
  avisos: string[];
  error?: string;
  estilo?: string;
};

/** Colores de marca: terracota para lo que espera, arena para lo ya aprobado. */
const ESTADO: Partial<Record<EstadoPieza, { texto: string; clase: string }>> = {
  pending: { texto: "Por revisar", clase: "bg-[#B45831]/15 text-[#B45831]" },
  approved: { texto: "Aprobada", clase: "bg-[#D0BC82]/35 text-[#7d6c2b]" },
  scheduled: { texto: "Programada", clase: "bg-[#8EB9C5]/30 text-[#3b7686]" },
  published: { texto: "Publicada", clase: "bg-emerald-500/15 text-emerald-700" },
  rejected: { texto: "Descartada", clase: "bg-muted text-muted-foreground" },
  failed: { texto: "Falló al publicar", clase: "bg-destructive/15 text-destructive" },
};

export function Pieza({
  clientId,
  pieza,
}: {
  clientId: string;
  pieza: PiezaData;
}) {
  const [texto, setTexto] = useState(pieza.caption);
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoPublicar | null>(null);

  const sucio = texto.trim() !== pieza.caption.trim();
  // Una pieza que falló al publicar sigue estando aprobada: se reintenta, no se
  // vuelve a aprobar.
  const sePuedePublicar =
    pieza.status === "approved" ||
    pieza.status === "scheduled" ||
    pieza.status === "failed";

  const publicar = () =>
    empezar(async () => {
      setResultado(await publicarPieza(clientId, pieza.id));
    });

  return (
    <Card className="overflow-hidden pt-0">
      <div className="relative aspect-[4/5] bg-muted">
        {pieza.mediaUrl ? (
          <Image
            src={pieza.mediaUrl}
            alt={pieza.titular || "Pieza generada"}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain"
          />
        ) : null}
        {ESTADO[pieza.status] && (
          <span
            className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${ESTADO[pieza.status]!.clase}`}
          >
            {ESTADO[pieza.status]!.texto}
          </span>
        )}
        {pieza.estilo && (
          <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">
            {pieza.estilo}
          </span>
        )}
      </div>

      <CardContent className="flex flex-col gap-3">
        <p className="truncate text-xs text-muted-foreground" title={pieza.producto}>
          {pieza.producto}
        </p>

        {pieza.avisos.length > 0 && (
          // Los avisos vienen del workflow: muletillas, materiales que no están
          // en el nombre del producto, hashtags de menos. No bloquean nada, solo
          // señalan dónde mirar antes de aprobar.
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <ul className="flex flex-col gap-0.5">
              {pieza.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <form action={guardarTexto} className="flex flex-col gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="item_id" value={pieza.id} />
          <Textarea
            name="caption"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="text-sm"
          />
          {sucio && (
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="secondary">
                Guardar texto
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setTexto(pieza.caption)}
              >
                Deshacer
              </Button>
            </div>
          )}
        </form>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        {/*
          El fallo guardado en la pieza y la respuesta de la última pulsación son
          cosas distintas: el primero sobrevive a recargar la página, el segundo
          es lo que acaba de pasar. Se enseña el reciente si lo hay.
        */}
        {(resultado || (pieza.status === "failed" && pieza.error)) && (
          <p
            className={`rounded-md px-2.5 py-2 text-xs ${
              resultado?.ok
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {resultado ? resultado.mensaje : pieza.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {pieza.status === "published" ? (
            <p className="text-xs text-muted-foreground">
              Publicada. Para cambiarla hay que hacerlo desde la propia red.
            </p>
          ) : sePuedePublicar ? (
            <>
              <Button size="sm" disabled={pendiente} onClick={publicar}>
                <Send className="size-4" />
                {pieza.status === "failed" ? "Reintentar" : "Publicar ahora"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pendiente}
                onClick={() => empezar(() => devolverAPendiente(clientId, pieza.id))}
              >
                <RotateCcw className="size-4" />
                Volver a revisar
              </Button>
            </>
          ) : pieza.status === "rejected" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() => empezar(() => devolverAPendiente(clientId, pieza.id))}
            >
              <RotateCcw className="size-4" />
              Volver a revisar
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                // Editar y aprobar a la vez sería aprobar algo distinto de lo que
                // se está viendo guardado. Primero se guarda el texto.
                disabled={pendiente || sucio}
                onClick={() => empezar(() => aprobarPieza(clientId, pieza.id))}
              >
                <Check className="size-4" />
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pendiente}
                onClick={() => empezar(() => descartarPieza(clientId, pieza.id))}
              >
                <X className="size-4" />
                Descartar
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
