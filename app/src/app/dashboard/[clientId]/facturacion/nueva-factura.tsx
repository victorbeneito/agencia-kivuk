"use client";

import { useTransition } from "react";
import { FilePlus2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { crearFactura } from "@/app/dashboard/facturacion/acciones";

/**
 * Crear una factura para este cliente sin esperar a la generación del periodo:
 * un trabajo puntual, un adelanto, un mes que hay que rehacer.
 */
export function NuevaFactura({ clientId }: { clientId: string }) {
  const [pendiente, empezar] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pendiente}
        onClick={() => empezar(() => crearFactura(clientId, true))}
      >
        <FilePlus2 className="size-4" />
        Facturar lo contratado
      </Button>
      <Button
        variant="outline"
        disabled={pendiente}
        onClick={() => empezar(() => crearFactura(clientId, false))}
      >
        Factura en blanco
      </Button>
    </div>
  );
}
