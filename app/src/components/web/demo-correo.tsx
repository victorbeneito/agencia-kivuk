import { Mail } from "lucide-react";
import { BadgeEnDesarrollo } from "./badge-en-desarrollo";

/**
 * La bandeja ya revisada.
 *
 * Distinto de lo que hoy manda `RESEND_API_KEY` (confirmaciones de cita, ya en
 * producción): esto es leer el correo QUE LLEGA al cliente, no mandar el que
 * sale. No tiene nada construido detrás — ver `docs/marketing-y-captacion.md`.
 */
export function DemoCorreo() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_-20px_rgba(43,63,77,0.35)] grayscale">
      <div className="flex items-center justify-between gap-3 bg-kivuk-pizarra px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Mail className="size-4 text-white" aria-hidden />
          <p className="text-sm font-semibold text-white">Bandeja de entrada</p>
        </div>
        <BadgeEnDesarrollo className="border-white/25 bg-white/10 text-white" />
      </div>

      <div className="divide-y divide-border">
        <div className="flex items-start gap-2 p-3.5">
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full bg-kivuk-terracota"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-kivuk-pizarra">
              Proveedor de mimbre — pedido retrasado
            </p>
            <p className="truncate text-xs text-kivuk-gris">Importante · resumen: llega el jueves</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3.5 opacity-60">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-border" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-kivuk-pizarra">
              Newsletter del gremio de artesanos
            </p>
            <p className="truncate text-xs text-kivuk-gris">Sin acción necesaria</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-secondary/40 p-3.5">
        <p className="text-xs font-medium text-kivuk-gris uppercase">
          Respuesta sugerida
        </p>
        <p className="mt-1 text-sm text-kivuk-pizarra">
          «Gracias por avisar, sin problema, lo esperamos para el jueves.»
        </p>
      </div>
    </div>
  );
}
