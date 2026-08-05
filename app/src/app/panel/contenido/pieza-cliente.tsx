"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  aprobar,
  descartar,
  guardarTexto,
  volverARevisar,
  type Resultado,
} from "./acciones";

export type PiezaCliente = {
  id: string;
  status: string;
  caption: string;
  mediaUrl: string;
  titular: string;
};

/**
 * Una pieza vista por el cliente.
 *
 * Deliberadamente más corta que la de la agencia: aquí no hay avisos del
 * generador, ni errores de publicación, ni botón de publicar ya. El cliente
 * decide sí o no sobre lo que va a salir con su nombre; el resto es fontanería
 * nuestra y solo añadiría ruido a esa decisión.
 */
const ESTADO: Record<string, { texto: string; clase: string }> = {
  pending: { texto: "Por revisar", clase: "bg-[#B45831]/15 text-[#B45831]" },
  failed: { texto: "Por revisar", clase: "bg-[#B45831]/15 text-[#B45831]" },
  approved: { texto: "Aprobada", clase: "bg-[#D0BC82]/35 text-[#7d6c2b]" },
  scheduled: { texto: "Programada", clase: "bg-[#8EB9C5]/30 text-[#3b7686]" },
  publishing: { texto: "Publicándose", clase: "bg-[#8EB9C5]/30 text-[#3b7686]" },
  published: { texto: "Publicada", clase: "bg-emerald-500/15 text-emerald-700" },
  rejected: { texto: "Descartada", clase: "bg-muted text-muted-foreground" },
};

export function PiezaCliente({ pieza }: { pieza: PiezaCliente }) {
  const [texto, setTexto] = useState(pieza.caption);
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sucio = texto.trim() !== pieza.caption.trim();
  const porRevisar = ["pending", "failed", "draft"].includes(pieza.status);
  const decidida = ["approved", "rejected"].includes(pieza.status);
  const cerrada = ["published", "publishing", "scheduled"].includes(pieza.status);
  const etiqueta = ESTADO[pieza.status];

  function ejecutar(accion: () => Promise<Resultado>) {
    setError(null);
    empezar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.mensaje ?? "No se pudo guardar.");
    });
  }

  return (
    <Card className="overflow-hidden pt-0">
      <div className="relative aspect-[4/5] bg-muted">
        {pieza.mediaUrl ? (
          <Image
            src={pieza.mediaUrl}
            alt={pieza.titular || "Pieza de contenido"}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain"
          />
        ) : null}
        {etiqueta && (
          <span
            className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${etiqueta.clase}`}
          >
            {etiqueta.texto}
          </span>
        )}
      </div>

      <CardContent className="flex flex-col gap-2">
        {cerrada ? (
          <p className="whitespace-pre-wrap text-sm">{pieza.caption}</p>
        ) : (
          <>
            <Textarea
              rows={6}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="text-sm"
            />
            {sucio && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pendiente}
                  onClick={() => ejecutar(() => guardarTexto(pieza.id, texto))}
                >
                  Guardar texto
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pendiente}
                  onClick={() => setTexto(pieza.caption)}
                >
                  Deshacer
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {porRevisar && (
            <>
              <Button
                size="sm"
                // Aprobar con cambios sin guardar sería dar por bueno un texto
                // distinto del que se está leyendo.
                disabled={pendiente || sucio}
                onClick={() => ejecutar(() => aprobar(pieza.id))}
              >
                <Check className="size-4" />
                Me gusta, publicadla
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pendiente}
                onClick={() => ejecutar(() => descartar(pieza.id))}
              >
                <X className="size-4" />
                Descartar
              </Button>
            </>
          )}

          {decidida && (
            <Button
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() => ejecutar(() => volverARevisar(pieza.id))}
            >
              <RotateCcw className="size-4" />
              Cambiar de idea
            </Button>
          )}

          {pieza.status === "published" && (
            <p className="text-xs text-muted-foreground">
              Ya está publicada. Para cambiarla hay que hacerlo desde la propia
              red social.
            </p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
