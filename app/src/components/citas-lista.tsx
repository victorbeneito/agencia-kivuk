"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Phone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  duracionDe,
  horaEnMadrid,
  type Cita,
  type DiaDeCitas,
} from "@/lib/citas";

export type Resultado = { ok: boolean; mensaje?: string };

/**
 * La agenda de los próximos días, igual para la agencia y para el cliente.
 *
 * Está pensada para leerse de pie y con una mano: la hora primero y grande,
 * porque es lo que se busca al abrirla, y debajo quién viene y a qué. El
 * teléfono es un enlace `tel:` — si alguien no aparece, lo que se hace es
 * llamarle, y no tener que copiar el número a mano es la diferencia entre que
 * se llame o no.
 */
export function CitasLista({
  dias,
  cancelar,
  vacio,
}: {
  dias: DiaDeCitas[];
  /** Si no se pasa, la lista es de solo lectura. */
  cancelar?: (citaId: string) => Promise<Resultado>;
  vacio: string;
}) {
  if (!dias.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
        <CalendarClock className="size-8 text-muted-foreground" />
        <p className="max-w-sm text-sm text-muted-foreground">{vacio}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {dias.map((dia) => (
        <section key={dia.fecha} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {dia.titulo}
            <span className="ml-2 font-normal">
              ({dia.citas.length} {dia.citas.length === 1 ? "cita" : "citas"})
            </span>
          </h3>

          <ul className="flex flex-col gap-2">
            {dia.citas.map((cita) => (
              <FilaCita key={cita.id} cita={cita} cancelar={cancelar} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilaCita({
  cita,
  cancelar,
}: {
  cita: Cita;
  cancelar?: (citaId: string) => Promise<Resultado>;
}) {
  const [enCurso, empezar] = useTransition();
  const [error, setError] = useState("");
  // Cancelar una cita es irreversible desde aquí y la persona ya está avisada
  // de una hora: se pide confirmación en el propio botón, sin diálogo, que en
  // el móvil es un salto de contexto para algo que se decide en un segundo.
  const [confirmando, setConfirmando] = useState(false);

  const servicios = cita.servicios.map((s) => s.nombre).join(" + ");

  function onCancelar() {
    if (!cancelar) return;
    setError("");
    empezar(async () => {
      const r = await cancelar(cita.id);
      if (!r.ok) setError(r.mensaje ?? "No se ha podido cancelar.");
      setConfirmando(false);
    });
  }

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium tabular-nums">
            {horaEnMadrid(cita.inicio)} – {horaEnMadrid(cita.fin)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {duracionDe(cita)} min
            </span>
          </p>

          <p className="truncate text-sm">
            {cita.nombre_contacto || "Sin nombre"}
            {cita.trabajador ? (
              <span className="text-muted-foreground"> · con {cita.trabajador}</span>
            ) : null}
          </p>

          {servicios ? (
            <p className="truncate text-sm text-muted-foreground">{servicios}</p>
          ) : null}

          {cita.notas ? (
            <p className="mt-1 text-xs text-muted-foreground">{cita.notas}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {cita.contacto ? (
            <Button
              variant="ghost"
              size="icon"
              title={cita.contacto}
              aria-label={`Llamar a ${cita.nombre_contacto || cita.contacto}`}
              render={<a href={`tel:${cita.contacto}`} />}
            >
              <Phone className="size-4" />
            </Button>
          ) : null}

          {cancelar ? (
            confirmando ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onCancelar}
                  disabled={enCurso}
                >
                  {enCurso ? "Cancelando…" : "Confirmar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmando(false)}
                  disabled={enCurso}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmando(true)}
                aria-label="Cancelar la cita"
                title="Cancelar la cita"
              >
                <X className="size-4" />
              </Button>
            )
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </li>
  );
}
