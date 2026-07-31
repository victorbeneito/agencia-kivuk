"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  aprobarPieza,
  descartarPieza,
  devolverAPendiente,
  guardarTexto,
  type EstadoPieza,
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
};

const ETIQUETA_ESTADO: Partial<Record<EstadoPieza, string>> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Descartada",
  scheduled: "Programada",
  published: "Publicada",
  failed: "Falló al publicar",
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

  const sucio = texto.trim() !== pieza.caption.trim();
  const yaDecidida = pieza.status === "approved" || pieza.status === "rejected";

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
        {ETIQUETA_ESTADO[pieza.status] && (
          <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs font-medium">
            {ETIQUETA_ESTADO[pieza.status]}
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

      <CardFooter className="gap-2">
        {yaDecidida ? (
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
      </CardFooter>
    </Card>
  );
}
