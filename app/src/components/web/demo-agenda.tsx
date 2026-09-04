import { CalendarCheck, Mail } from "lucide-react";

/**
 * La cita, ya confirmada.
 *
 * No es un calendario funcional: es la instantánea del resultado, que es lo
 * que le importa a quien decide si contratar. Sigue a la misma clienta del
 * ejemplo de WhatsApp del hero (Marta, la cestería) para que las pestañas se
 * lean como una sola historia y no como demos sueltas.
 */
export function DemoAgenda() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_-20px_rgba(43,63,77,0.35)]">
      <div className="flex items-center gap-3 bg-kivuk-azul-hondo px-4 py-3.5">
        <CalendarCheck className="size-5 text-white" aria-hidden />
        <p className="text-sm font-semibold text-white">Agenda · Google Calendar</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="text-xs font-medium tracking-wide text-kivuk-gris uppercase">
            Miércoles 20
          </p>
          <p className="mt-1 text-2xl font-bold text-kivuk-pizarra">17:30</p>
          <p className="mt-1 text-sm text-kivuk-gris">Marta — visita al taller</p>
        </div>

        <div className="flex items-start gap-2.5 border-t border-border pt-4 text-sm text-kivuk-gris">
          <Mail className="mt-0.5 size-4 shrink-0 text-kivuk-azul-hondo" aria-hidden />
          <p>
            Confirmación enviada a{" "}
            <span className="font-medium text-kivuk-pizarra">marta@ejemplo.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}
