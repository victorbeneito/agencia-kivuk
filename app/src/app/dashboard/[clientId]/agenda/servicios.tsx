"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { borrarServicio, guardarServicio, type Resultado } from "./acciones";

export type ServicioAgenda = {
  id: string;
  nombre: string;
  duracionMin: number;
  alias: string[];
  activo: boolean;
  /** Ids de `staff` que pueden hacerlo. */
  trabajadores: string[];
};

export type TrabajadorBreve = { id: string; nombre: string; activo: boolean };

function duracionLegible(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function FormularioServicio({
  clientId,
  servicio,
  trabajadores,
  onHecho,
}: {
  clientId: string;
  servicio?: ServicioAgenda;
  trabajadores: TrabajadorBreve[];
  onHecho: (r: Resultado) => void;
}) {
  const [pendiente, empezar] = useTransition();
  const id = servicio?.id ?? "nuevo";

  return (
    <form
      action={(formData) => {
        empezar(async () => onHecho(await guardarServicio(formData)));
      }}
      className="flex flex-col gap-5 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="client_id" value={clientId} />
      {servicio && <input type="hidden" name="servicio_id" value={servicio.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`nombre-${id}`}>Servicio</Label>
          <Input
            id={`nombre-${id}`}
            name="nombre"
            required
            defaultValue={servicio?.nombre}
            placeholder="Corte y mechas"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`duracion-${id}`}>Duración (minutos)</Label>
          <Input
            id={`duracion-${id}`}
            name="duracion_min"
            type="number"
            min={5}
            max={600}
            step={5}
            required
            defaultValue={servicio?.duracionMin ?? 30}
          />
          <p className="text-xs text-muted-foreground">
            Lo que ocupa en la agenda. Si alguien pide varios servicios en la
            misma visita, se suman.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`alias-${id}`}>Cómo lo llama la gente</Label>
        <Input
          id={`alias-${id}`}
          name="alias"
          defaultValue={servicio?.alias.join(", ")}
          placeholder="mechitas, reflejos, californianas"
        />
        <p className="text-xs text-muted-foreground">
          Separados por comas. Nadie escribe por WhatsApp el nombre exacto del
          servicio, y con esto el bot reconoce igualmente lo que le piden.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Quién lo hace</Label>
        {trabajadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Añade antes algún trabajador.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trabajadores.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="checkbox"
                  name="trabajadores"
                  value={t.id}
                  defaultChecked={servicio?.trabajadores.includes(t.id)}
                  className="size-4 accent-primary"
                />
                {t.nombre}
                {!t.activo && (
                  <span className="text-xs text-muted-foreground">(inactivo)</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onHecho({ ok: true, mensaje: "" })}
        >
          Cancelar
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="activo"
            value="si"
            defaultChecked={servicio?.activo ?? true}
            className="size-4 accent-primary"
          />
          Se puede reservar
        </label>
      </div>
    </form>
  );
}

/**
 * Qué se reserva, cuánto dura y quién lo hace.
 *
 * La lista de quién lo hace es la que contesta "las mechas solo las hacen Bea y
 * Sonia". Un servicio sin nadie marcado se avisa en pantalla: el bot no puede
 * ofrecer una cita que después no hay quien atienda.
 */
export function ServiciosAgenda({
  clientId,
  servicios,
  trabajadores,
}: {
  clientId: string;
  servicios: ServicioAgenda[];
  trabajadores: TrabajadorBreve[];
}) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [, empezar] = useTransition();

  const nombrePorId = new Map(trabajadores.map((t) => [t.id, t.nombre]));

  function alTerminar(cerrar: () => void) {
    return (r: Resultado) => {
      setResultado(r.mensaje ? r : null);
      if (r.ok) cerrar();
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {creando ? (
        <FormularioServicio
          clientId={clientId}
          trabajadores={trabajadores}
          onHecho={alTerminar(() => setCreando(false))}
        />
      ) : (
        <Button className="w-fit" onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      )}

      {servicios.length === 0 && !creando && (
        <p className="text-sm text-muted-foreground">
          Sin servicios, todas las citas duran lo que diga el horario de atención
          y las puede atender cualquiera. Defínelos si el negocio tiene trabajos
          de duraciones distintas o que no hace todo el mundo.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {servicios.map((s) =>
          editando === s.id ? (
            <FormularioServicio
              key={s.id}
              clientId={clientId}
              servicio={s}
              trabajadores={trabajadores}
              onHecho={alTerminar(() => setEditando(null))}
            />
          ) : (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {s.nombre}
                  <span className="text-sm font-normal text-muted-foreground">
                    {duracionLegible(s.duracionMin)}
                  </span>
                  {!s.activo && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      No reservable
                    </span>
                  )}
                </p>

                {s.trabajadores.length ? (
                  <p className="text-sm text-muted-foreground">
                    Lo hacen:{" "}
                    {s.trabajadores
                      .map((id) => nombrePorId.get(id) ?? "?")
                      .join(", ")}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertTriangle className="size-3.5" />
                    No lo hace nadie, así que no se puede reservar
                  </p>
                )}

                {s.alias.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    También: {s.alias.join(", ")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${s.nombre}`}
                  onClick={() => setEditando(s.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Borrar ${s.nombre}`}
                  onClick={() => {
                    if (
                      !confirm(
                        `¿Borrar «${s.nombre}»? Las citas que ya lo tenían no cambian.`
                      )
                    )
                      return;
                    empezar(async () =>
                      setResultado(await borrarServicio(clientId, s.id))
                    );
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {resultado && (
        <p
          className={
            resultado.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"
          }
        >
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
