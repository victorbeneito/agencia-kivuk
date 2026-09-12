"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  NuevaCita,
  ServicioReservable,
  TrabajadorDeCalendario,
} from "@/lib/citas";

export type Resultado = { ok: boolean; mensaje?: string };

/** Lo que trae el hueco pulsado en la rejilla, para no teclear lo que ya se sabe. */
export type CitaPrevia = {
  staff_id: string;
  fecha: string;
  hora: string;
};

const CAMPO =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * Dar una cita a mano.
 *
 * Es la mitad que le faltaba a la agenda. Una peluquería da muchas de sus citas
 * en el mostrador —la clienta se va y pide la siguiente—, y una agenda donde
 * eso no se puede anotar obliga a llevar además la libreta de siempre; con lo
 * cual ni la libreta ni la pantalla están completas, que es peor que tener solo
 * la libreta.
 *
 * El formulario llega con el día, la hora y la persona ya puestos, porque se
 * abre pulsando el hueco: lo único que queda por escribir es quién viene y a
 * qué. Elegir el servicio rellena la duración, y la duración se puede cambiar
 * —en un salón se acorta y se alarga a ojo, y una pantalla que no deje hacerlo
 * se queda fuera el primer día.
 */
export function NuevaCitaDialogo({
  previa,
  trabajadores,
  servicios,
  crear,
  onCerrar,
}: {
  previa: CitaPrevia;
  trabajadores: TrabajadorDeCalendario[];
  servicios: ServicioReservable[];
  crear: (datos: NuevaCita) => Promise<Resultado>;
  onCerrar: () => void;
}) {
  const [enCurso, empezar] = useTransition();
  const [error, setError] = useState("");

  const [staffId, setStaffId] = useState(previa.staff_id);
  const [fecha, setFecha] = useState(previa.fecha);
  const [hora, setHora] = useState(previa.hora);
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? "");
  const [duracion, setDuracion] = useState(servicios[0]?.duracion_min ?? 30);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [notas, setNotas] = useState("");

  const servicio = servicios.find((x) => x.id === servicioId);
  const trabajador = trabajadores.find((t) => t.id === staffId);

  function guardar() {
    setError("");
    empezar(async () => {
      const r = await crear({
        staff_id: staffId,
        fecha,
        hora,
        duracion_min: duracion,
        servicio_id: servicioId || null,
        servicio_nombre: servicio?.nombre ?? "",
        nombre,
        contacto,
        notas,
      });

      if (r.ok) onCerrar();
      else setError(r.mensaje ?? "No se ha podido guardar.");
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/30 p-4 sm:items-center"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Nueva cita"
      >
        <h2 className="text-lg font-medium">Nueva cita</h2>
        <p className="text-sm text-muted-foreground">
          {trabajador ? `Con ${trabajador.nombre}. ` : ""}
          La reserva se comprueba al guardar: si esa hora se acaba de ocupar, se
          avisa y no se pierde nada.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cita-fecha">Día</Label>
              <Input
                id="cita-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cita-hora">Hora</Label>
              <Input
                id="cita-hora"
                type="time"
                step={300}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cita-staff">Con quién</Label>
            <select
              id="cita-staff"
              className={CAMPO}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cita-servicio">Qué se hace</Label>
              <select
                id="cita-servicio"
                className={CAMPO}
                value={servicioId}
                // Elegir servicio trae su duración. Se hace aquí y no en un
                // efecto porque es una consecuencia de la acción, no del
                // estado: si alguien retoca los minutos a mano y no toca el
                // servicio, sus minutos se quedan.
                onChange={(e) => {
                  setServicioId(e.target.value);
                  const s = servicios.find((x) => x.id === e.target.value);
                  if (s) setDuracion(s.duracion_min);
                }}
              >
                {servicios.length ? null : <option value="">Sin servicios definidos</option>}
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.duracion_min} min)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cita-duracion">Minutos</Label>
              <Input
                id="cita-duracion"
                type="number"
                min={5}
                max={600}
                step={5}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cita-nombre">Quién viene</Label>
            <Input
              id="cita-nombre"
              value={nombre}
              placeholder="Nombre de la clienta"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cita-contacto">Teléfono (opcional)</Label>
            <Input
              id="cita-contacto"
              inputMode="tel"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cita-notas">Notas (opcional)</Label>
            <Textarea
              id="cita-notas"
              rows={2}
              value={notas}
              placeholder="Color 7.3, viene con su hija…"
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={guardar} disabled={enCurso}>
            {enCurso ? "Guardando…" : "Guardar cita"}
          </Button>
          <Button variant="outline" onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
