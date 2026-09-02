"use client";

import { useState, useTransition } from "react";
import { FilePlus2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { crearFactura, generarRecurrentes, type Resultado } from "./acciones";

/**
 * Las dos formas de que nazca una factura: la del mes, que sale sola de lo que
 * cada cliente tiene contratado, y la suelta para un trabajo puntual.
 *
 * La primera es la que se usa cada mes y por eso va primero y destacada. Las dos
 * dejan borradores: nada se emite sin que alguien lo mire.
 */
export function BarraAcciones({
  clientes,
}: {
  clientes: { id: string; name: string }[];
}) {
  const [cliente, setCliente] = useState(clientes[0]?.id ?? "");
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pendiente}
          onClick={() =>
            empezar(async () => setResultado(await generarRecurrentes()))
          }
        >
          <RefreshCw className="size-4" />
          {pendiente ? "Preparando…" : "Generar facturas del periodo"}
        </Button>

        {clientes.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="border-input h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={pendiente || !cliente}
              onClick={() => empezar(() => crearFactura(cliente))}
            >
              <FilePlus2 className="size-4" />
              Factura suelta
            </Button>
          </div>
        )}
      </div>

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
