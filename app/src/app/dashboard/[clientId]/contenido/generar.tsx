"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generarLote, type ResultadoPublicar } from "./actions";

/**
 * Generación de un lote nuevo desde el panel.
 *
 * Solo `post` y `story`: el render también sabe hacer cuadrado, pero
 * `content_items.format` no lo admite todavía y fallaría al guardar.
 */
const FORMATOS = [
  { valor: "post", etiqueta: "Post (4:5)" },
  { valor: "story", etiqueta: "Story (9:16)" },
];

export function GenerarLote({ clientId }: { clientId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState(9);
  const [formato, setFormato] = useState("post");
  const [tema, setTema] = useState("");
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoPublicar | null>(null);

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setAbierto(true)}>
          <Sparkles className="size-4" />
          Generar contenido
        </Button>
        {resultado && (
          <span
            className={`text-sm ${resultado.ok ? "text-emerald-700" : "text-destructive"}`}
          >
            {resultado.mensaje}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-[auto_auto_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cantidad">Cuántas</Label>
          <Input
            id="cantidad"
            type="number"
            min={1}
            max={20}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className="w-24"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="formato">Formato</Label>
          <select
            id="formato"
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tema">Tema (opcional)</Label>
          <Input
            id="tema"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="vuelta al cole, tonos cálidos, dormitorio infantil…"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Los productos los elige el sistema según el producto estrella que tengas
        configurado, variando la temática para que el lote no se repita. Todo
        sale «por revisar»: no se publica nada solo.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await generarLote(clientId, cantidad, formato, tema);
              setResultado(r);
              if (r.ok) setAbierto(false);
            })
          }
        >
          <Sparkles className="size-4" />
          {pendiente ? "Generando…" : `Generar ${cantidad}`}
        </Button>
        <Button
          variant="ghost"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
        {pendiente && (
          <span className="text-sm text-muted-foreground">
            Un par de minutos: cada pieza lleva su texto y su imagen.
          </span>
        )}
        {resultado && !pendiente && (
          <span
            className={`text-sm ${resultado.ok ? "text-emerald-700" : "text-destructive"}`}
          >
            {resultado.mensaje}
          </span>
        )}
      </div>
    </div>
  );
}
