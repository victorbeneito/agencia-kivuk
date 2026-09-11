"use client";

import { useState, useTransition } from "react";
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIAS_SEMANA, type Tramo } from "@/lib/agenda";
import {
  borrarTrabajador,
  crearTrabajador,
  guardarTrabajador,
  type Resultado,
} from "./acciones";

export type Trabajador = {
  id: string;
  nombre: string;
  calendarId: string;
  activo: boolean;
  horario: Tramo[];
};

/** "L, M, X y V" — el horario de un vistazo, sin abrir el formulario. */
function resumenDias(horario: Tramo[]): string {
  const dias = DIAS_SEMANA.filter((d) =>
    horario.some((t) => t.dia === Number(d.valor))
  ).map((d) => d.etiqueta);

  if (!dias.length) return "sin días de trabajo";
  if (dias.length === 1) return dias[0];
  return `${dias.slice(0, -1).join(", ")} y ${dias[dias.length - 1]}`;
}

function FormularioTrabajador({
  clientId,
  trabajador,
  onHecho,
}: {
  clientId: string;
  trabajador?: Trabajador;
  onHecho: (r: Resultado) => void;
}) {
  const [pendiente, empezar] = useTransition();
  const id = trabajador?.id ?? "nuevo";

  return (
    <form
      action={(formData) => {
        empezar(async () => {
          onHecho(
            trabajador
              ? await guardarTrabajador(formData)
              : await crearTrabajador(formData)
          );
        });
      }}
      className="flex flex-col gap-5 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="client_id" value={clientId} />
      {trabajador && (
        <input type="hidden" name="staff_id" value={trabajador.id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`nombre-${id}`}>Nombre</Label>
          <Input
            id={`nombre-${id}`}
            name="nombre"
            required
            defaultValue={trabajador?.nombre}
            placeholder="Ana"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`calendar-${id}`}>Calendario de Google</Label>
          <Input
            id={`calendar-${id}`}
            name="calendar_id"
            defaultValue={trabajador?.calendarId}
            placeholder="ana@group.calendar.google.com"
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Sirve para que vea sus citas en el móvil y para que el bot
            respete lo que se bloquee ella misma. Sin él, sus citas viven solo
            aquí y todo funciona igual.
          </p>
        </div>
      </div>

      {trabajador && (
        <div className="flex flex-col gap-4">
          <div>
            <Label>Horario</Label>
            <p className="text-xs text-muted-foreground">
              Marca los días que trabaja. La segunda franja es para el horario
              partido; déjala vacía si hace jornada seguida.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {DIAS_SEMANA.map((d) => {
              const tramos = trabajador.horario
                .filter((t) => t.dia === Number(d.valor))
                .sort((a, b) => a.inicio.localeCompare(b.inicio));

              return (
                <div key={d.valor} className="flex flex-wrap items-center gap-2">
                  <label className="flex w-28 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`dia_${d.valor}`}
                      value="si"
                      defaultChecked={tramos.length > 0}
                      className="size-4 accent-primary"
                    />
                    {d.nombre}
                  </label>

                  <div className="flex items-center gap-1">
                    <Input
                      type="time"
                      name={`manana_inicio_${d.valor}`}
                      defaultValue={tramos[0]?.inicio ?? ""}
                      className="w-28"
                      aria-label={`${d.nombre}, primera franja, desde`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      name={`manana_fin_${d.valor}`}
                      defaultValue={tramos[0]?.fin ?? ""}
                      className="w-28"
                      aria-label={`${d.nombre}, primera franja, hasta`}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      type="time"
                      name={`tarde_inicio_${d.valor}`}
                      defaultValue={tramos[1]?.inicio ?? ""}
                      className="w-28"
                      aria-label={`${d.nombre}, segunda franja, desde`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      name={`tarde_fin_${d.valor}`}
                      defaultValue={tramos[1]?.fin ?? ""}
                      className="w-28"
                      aria-label={`${d.nombre}, segunda franja, hasta`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        {trabajador && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="activo"
              value="si"
              defaultChecked={trabajador.activo}
              className="size-4 accent-primary"
            />
            Recibe citas
          </label>
        )}
      </div>
    </form>
  );
}

/**
 * Quién atiende en el negocio.
 *
 * Un trabajador nuevo nace con el horario del negocio ya puesto, no en blanco:
 * sin ninguna franja horaria no trabaja nunca, y alguien recién creado que el
 * bot no ofrece jamás es un fallo difícil de ver desde esta pantalla.
 */
export function Trabajadores({
  clientId,
  trabajadores,
}: {
  clientId: string;
  trabajadores: Trabajador[];
}) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [, empezar] = useTransition();

  function alTerminar(cerrar: () => void) {
    return (r: Resultado) => {
      setResultado(r.mensaje ? r : null);
      if (r.ok) cerrar();
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {creando ? (
        <FormularioTrabajador
          clientId={clientId}
          onHecho={alTerminar(() => setCreando(false))}
        />
      ) : (
        <Button className="w-fit" onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nuevo trabajador
        </Button>
      )}

      {trabajadores.length === 0 && !creando && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay nadie. Si en el negocio atiende una sola persona, con un
          trabajador basta y el bot no lo nombrará nunca en los mensajes.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {trabajadores.map((t) =>
          editando === t.id ? (
            <FormularioTrabajador
              key={t.id}
              clientId={clientId}
              trabajador={t}
              onHecho={alTerminar(() => setEditando(null))}
            />
          ) : (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {t.nombre}
                  {!t.activo && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      No recibe citas
                    </span>
                  )}
                  {!t.calendarId && (
                    <span
                      title="Sin calendario de Google. Sus citas viven solo en el panel."
                      className="text-muted-foreground"
                    >
                      <CalendarOff className="size-3.5" />
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {resumenDias(t.horario)}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${t.nombre}`}
                  onClick={() => setEditando(t.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Borrar ${t.nombre}`}
                  onClick={() => {
                    if (!confirm(`¿Borrar a ${t.nombre}?`)) return;
                    empezar(async () =>
                      setResultado(await borrarTrabajador(clientId, t.id))
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
