import { Phone } from "lucide-react";
import { BadgeEnDesarrollo } from "./badge-en-desarrollo";

/**
 * Una llamada que todavía no existe.
 *
 * A propósito en tono grisáceo y con la etiqueta encima del todo, no en una
 * esquina: es la única pestaña donde el mockup podría confundirse con un
 * producto real, así que aquí el aviso pesa más que en Correo.
 */
export function DemoVoz() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_-20px_rgba(43,63,77,0.35)] grayscale">
      <div className="flex items-center justify-between gap-3 bg-kivuk-pizarra px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Phone className="size-4 text-white" aria-hidden />
          <p className="text-sm font-semibold text-white">Llamada entrante</p>
        </div>
        <BadgeEnDesarrollo className="border-white/25 bg-white/10 text-white" />
      </div>

      <div className="space-y-2.5 bg-secondary/30 p-4">
        <div className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-kivuk-pizarra shadow-sm">
          ¿Tenéis mesa para el sábado a las nueve?
        </div>
        <div className="ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-kivuk-pizarra shadow-sm">
          Sí, tengo hueco a las 21:00 para dos. ¿Te lo reservo?
        </div>
      </div>

      <p className="px-4 py-3 text-center text-xs text-kivuk-gris">
        Ejemplo de lo que hará, no una llamada real.
      </p>
    </div>
  );
}
