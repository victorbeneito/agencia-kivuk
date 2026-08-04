"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { subirPieza, type ResultadoPublicar } from "./actions";

/**
 * Alta manual de una pieza hecha en otra herramienta.
 *
 * Las proporciones son las que acepta Instagram, no un capricho: si se sube
 * algo fuera de rango, el servicio de imagen lo rechaza con el motivo antes de
 * que llegue a la cola, en vez de fallar al publicar cuando ya está aprobada.
 */
const FORMATOS = [
  { valor: "post", etiqueta: "Post — entre 4:5 y 1,91:1" },
  { valor: "story", etiqueta: "Story — entre 9:16 y 1:1" },
];

export function SubirPieza({ clientId }: { clientId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoPublicar | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!abierto) {
    return (
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <Upload className="size-4" />
        Subir una pieza
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) =>
        empezar(async () => {
          const r = await subirPieza(fd);
          setResultado(r);
          if (r.ok) {
            formRef.current?.reset();
            setNombre("");
            setAbierto(false);
          }
        })
      }
      className="flex w-full flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="client_id" value={clientId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivo">Imagen</Label>
          <Input
            id="archivo"
            name="archivo"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setNombre(e.target.files?.[0]?.name ?? "")}
          />
          <p className="text-sm text-muted-foreground">
            {nombre || "JPG o PNG. Los PNG se convierten solos: Instagram no los admite."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="formato-subida">Formato</Label>
          <select
            id="formato-subida"
            name="formato"
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caption-subida">Texto</Label>
        <Textarea
          id="caption-subida"
          name="caption"
          rows={5}
          required
          placeholder={"Lo que se lee debajo de la foto.\n\n#hashtags al final"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          <Upload className="size-4" />
          {pendiente ? "Subiendo…" : "Añadir a la cola"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
        {resultado && !pendiente && (
          <span
            className={`text-sm ${resultado.ok ? "text-emerald-700" : "text-destructive"}`}
          >
            {resultado.mensaje}
          </span>
        )}
      </div>
    </form>
  );
}
