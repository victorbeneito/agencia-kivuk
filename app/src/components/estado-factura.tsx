import { ESTADOS, estaVencida, type EstadoFactura } from "@/lib/facturacion";
import { cn } from "@/lib/utils";

/**
 * El estado de una factura de un vistazo.
 *
 * «Vencida» no es un estado guardado sino una consecuencia de la fecha: una
 * factura emitida o enviada cuyo vencimiento ya pasó. Guardarlo obligaría a un
 * proceso que repasara la tabla cada noche para cambiar filas que nadie ha
 * tocado; calcularlo al pintar da lo mismo y no puede quedarse desfasado.
 */
const TONOS: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  emitida: "bg-[#8EB9C5]/25 text-[#3b7686]",
  enviada: "bg-[#D0BC82]/30 text-[#87752f]",
  pagada: "bg-emerald-500/15 text-emerald-700",
  anulada: "bg-muted text-muted-foreground line-through",
  vencida: "bg-[#B45831]/15 text-[#B45831]",
};

export function EstadoFacturaBadge({
  estado,
  fechaVencimiento,
  className,
}: {
  estado: EstadoFactura;
  fechaVencimiento?: string | null;
  className?: string;
}) {
  const vencida = estaVencida({ estado, fecha_vencimiento: fechaVencimiento ?? null });
  const clave = vencida ? "vencida" : estado;

  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONOS[clave],
        className
      )}
    >
      {vencida ? "Vencida" : ESTADOS[estado]}
    </span>
  );
}
