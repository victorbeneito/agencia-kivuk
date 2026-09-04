import { Hammer } from "lucide-react";

/**
 * La etiqueta de «esto todavía no está en producción».
 *
 * Un único sitio para decidir cómo se dice: hoy son Voz y Correo
 * (`components/web/servicios-tabs.tsx`), y si alguno pasa a producción, basta
 * con quitarle esta etiqueta ahí — no hay que buscar el texto por la página.
 */
export function BadgeEnDesarrollo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-kivuk-terracota/25 bg-kivuk-terracota/10 px-2.5 py-1 text-xs font-semibold text-kivuk-terracota ${className}`}
    >
      <Hammer className="size-3" aria-hidden />
      En desarrollo
    </span>
  );
}
