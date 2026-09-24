"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fechaEnMadrid,
  horaEnMadrid,
  type Cita,
  type NuevaCita,
  type NuevoBloqueo,
  type ServicioReservable,
  type TrabajadorDeCalendario,
} from "@/lib/citas";

export type Resultado = { ok: boolean; mensaje?: string };

/** Lo que trae el hueco pulsado en la rejilla, para no teclear lo que ya se sabe. */
export type CitaPrevia = {
  staff_id: string;
  fecha: string;
  hora: string;
};

/** "10:30" -> "11:30". El fin del bloqueo empieza proponiendo una hora. */
function sumarHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}

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
  cita,
  trabajadores,
  servicios,
  crear,
  editar,
  bloquear,
  onCerrar,
}: {
  previa: CitaPrevia;
  /**
   * La cita que se está corrigiendo. Con ella el formulario es el mismo, pero
   * llega relleno y guarda encima en vez de crear: lo que se corrige de una
   * cita son los mismos campos con los que se da, y mantener dos pantallas
   * parecidas es garantizar que una se quede atrás.
   */
  cita?: Cita;
  trabajadores: TrabajadorDeCalendario[];
  servicios: ServicioReservable[];
  /** Hace falta para dar una cita nueva; en modo edición no se usa. */
  crear?: (datos: NuevaCita) => Promise<Resultado>;
  /** Hace falta para que el modo edición pueda guardar. */
  editar?: (citaId: string, datos: NuevaCita) => Promise<Resultado>;
  /** Si no se pasa, solo se pueden dar citas. */
  bloquear?: (datos: NuevoBloqueo) => Promise<Resultado>;
  onCerrar: () => void;
}) {
  const [enCurso, empezar] = useTransition();
  const [error, setError] = useState("");

  // Cita o bloqueo son la misma decisión tomada sobre el mismo hueco, así que
  // comparten formulario: señalas la hora y luego dices qué va ahí. Separarlos
  // en dos botones distintos obligaría a elegir antes de mirar el calendario.
  const [modo, setModo] = useState<"cita" | "bloqueo">("cita");
  const [todoElDia, setTodoElDia] = useState(false);
  const [hastaDia, setHastaDia] = useState(previa.fecha);
  const [horaFin, setHoraFin] = useState(sumarHora(previa.hora));
  const [motivo, setMotivo] = useState("");

  // Los servicios de una cita se guardan copiados (nombre y minutos), no
  // apuntando al catálogo: así renombrar un servicio no reescribe lo que pasó.
  // Para marcar las casillas hay que volver a emparejarlos por nombre, y lo que
  // ya no exista en el catálogo simplemente no se marca; su duración sí se
  // conserva, que es lo que ocupa el hueco.
  const delCatalogo = (cita?.servicios ?? [])
    .map((s) => servicios.find((x) => x.nombre === s.nombre))
    .filter((x): x is ServicioReservable => Boolean(x));

  const minutosDeLaCita = cita
    ? Math.round((new Date(cita.fin).getTime() - new Date(cita.inicio).getTime()) / 60000)
    : 0;

  const [staffId, setStaffId] = useState(cita?.staff_id ?? previa.staff_id);
  const [fecha, setFecha] = useState(cita ? fechaEnMadrid(cita.inicio) : previa.fecha);
  const [hora, setHora] = useState(cita ? horaEnMadrid(cita.inicio) : previa.hora);
  // Varios, porque una visita es "lavar y cortar" mucho más a menudo que una
  // sola cosa. El orden es el de la lista del negocio, que es el orden en que
  // se hacen.
  const [elegidos, setElegidos] = useState<string[]>(
    cita
      ? delCatalogo.map((x) => x.id)
      : servicios[0]
        ? [servicios[0].id]
        : []
  );
  const [duracion, setDuracion] = useState(
    cita ? minutosDeLaCita : servicios[0]?.duracion_min ?? 30
  );
  // Si alguien ha retocado los minutos a mano, marcar otro servicio no se los
  // pisa: se respeta lo que ha escrito una persona por encima del catálogo.
  // Al abrir una cita ya dada se da por tocada solo si sus minutos no son los
  // del catálogo —alguien la alargó, o el servicio ya no existe—; si cuadran,
  // cambiar de tratamiento vuelve a recalcular la duración, que es lo que se
  // espera al corregirlo.
  const [duracionTocada, setDuracionTocada] = useState(
    Boolean(cita) &&
      delCatalogo.reduce((t, x) => t + x.duracion_min, 0) !== minutosDeLaCita
  );
  const [nombre, setNombre] = useState(cita?.nombre_contacto ?? "");
  const [contacto, setContacto] = useState(cita?.contacto ?? "");
  const [notas, setNotas] = useState(cita?.notas ?? "");

  const elegidosEnOrden = servicios.filter((x) => elegidos.includes(x.id));
  const trabajador = trabajadores.find((t) => t.id === staffId);

  function alternar(id: string) {
    const nuevos = elegidos.includes(id)
      ? elegidos.filter((x) => x !== id)
      : [...elegidos, id];

    setElegidos(nuevos);

    if (!duracionTocada) {
      const suma = servicios
        .filter((x) => nuevos.includes(x.id))
        .reduce((t, x) => t + x.duracion_min, 0);
      if (suma) setDuracion(suma);
    }
  }

  function guardarBloqueo() {
    if (!bloquear) return;
    setError("");
    empezar(async () => {
      const r = await bloquear({
        staff_id: staffId,
        desde: fecha,
        hasta: todoElDia ? hastaDia : fecha,
        todo_el_dia: todoElDia,
        hora_inicio: hora,
        hora_fin: horaFin,
        motivo,
      });

      if (r.ok) onCerrar();
      else setError(r.mensaje ?? "No se ha podido guardar.");
    });
  }

  function guardar() {
    if (modo === "bloqueo") return guardarBloqueo();
    setError("");
    empezar(async () => {
      const datos = {
        staff_id: staffId,
        fecha,
        hora,
        duracion_min: duracion,
        servicios: elegidosEnOrden.map((x) => ({
          id: x.id,
          nombre: x.nombre,
          duracion_min: x.duracion_min,
        })),
        nombre,
        contacto,
        notas,
      };

      const r =
        cita && editar
          ? await editar(cita.id, datos)
          : crear
            ? await crear(datos)
            : { ok: false, mensaje: "Esta agenda es de solo lectura." };

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
        aria-label={cita ? "Editar cita" : "Nueva cita"}
      >
        {bloquear && !cita ? (
          <div className="mb-3 flex overflow-hidden rounded-lg border">
            {([
              { clave: "cita" as const, texto: "Dar cita" },
              { clave: "bloqueo" as const, texto: "Bloquear un rato" },
            ]).map((o) => (
              <button
                key={o.clave}
                type="button"
                onClick={() => {
                  setModo(o.clave);
                  setError("");
                }}
                className={
                  "flex-1 px-3 py-1.5 text-sm transition-colors " +
                  (modo === o.clave
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted")
                }
              >
                {o.texto}
              </button>
            ))}
          </div>
        ) : null}

        <h2 className="text-lg font-medium">
          {cita ? "Editar cita" : modo === "cita" ? "Nueva cita" : "Bloquear un rato"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {cita
            ? "A quien tiene la cita no se le avisa de los cambios: eso sigue siendo una llamada."
            : modo === "cita"
              ? `${trabajador ? `Con ${trabajador.nombre}. ` : ""}La reserva se comprueba al guardar: si esa hora se acaba de ocupar, se avisa y no se pierde nada.`
              : "El bot deja de ofrecer estas horas. No es una cita: no aparece a nombre de nadie ni se le manda nada a nadie."}
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
            <div
              className={
                modo === "bloqueo" && todoElDia ? "hidden" : "flex flex-col gap-1.5"
              }
            >
              <Label htmlFor="cita-hora">
                {modo === "cita" ? "Hora" : "Desde las"}
              </Label>
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

          {modo === "bloqueo" ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={todoElDia}
                  onChange={(e) => setTodoElDia(e.target.checked)}
                />
                Días enteros (vacaciones, una baja)
              </label>

              {todoElDia ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bloqueo-hasta">Hasta el día (incluido)</Label>
                  <Input
                    id="bloqueo-hasta"
                    type="date"
                    value={hastaDia}
                    min={fecha}
                    onChange={(e) => setHastaDia(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bloqueo-fin">Hasta las</Label>
                  <Input
                    id="bloqueo-fin"
                    type="time"
                    step={300}
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bloqueo-motivo">Motivo (opcional)</Label>
                <Input
                  id="bloqueo-motivo"
                  value={motivo}
                  placeholder="Médico, formación, vacaciones…"
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
            </>
          ) : null}

          <div className={modo === "cita" ? "flex flex-col gap-1.5" : "hidden"}>
            <Label>Qué se hace</Label>
            {servicios.length ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2">
                {servicios.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={elegidos.includes(s.id)}
                      onChange={() => alternar(s.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.duracion_min} min
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este negocio no tiene servicios definidos todavía.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Label htmlFor="cita-duracion" className="shrink-0">
                Ocupa
              </Label>
              <Input
                id="cita-duracion"
                type="number"
                className="w-24"
                min={5}
                max={600}
                step={5}
                value={duracion}
                onChange={(e) => {
                  setDuracion(Number(e.target.value));
                  setDuracionTocada(true);
                }}
              />
              <span className="text-sm text-muted-foreground">
                minutos
                {elegidosEnOrden.length > 1
                  ? ` · ${elegidosEnOrden.map((x) => x.nombre).join(" + ")}`
                  : ""}
              </span>
            </div>
          </div>

          <div className={modo === "cita" ? "flex flex-col gap-1.5" : "hidden"}>
            <Label htmlFor="cita-nombre">Quién viene</Label>
            <Input
              id="cita-nombre"
              value={nombre}
              placeholder="Nombre de la clienta"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className={modo === "cita" ? "flex flex-col gap-1.5" : "hidden"}>
            <Label htmlFor="cita-contacto">Teléfono (opcional)</Label>
            <Input
              id="cita-contacto"
              inputMode="tel"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </div>

          <div className={modo === "cita" ? "flex flex-col gap-1.5" : "hidden"}>
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
            {enCurso
              ? "Guardando…"
              : cita
                ? "Guardar cambios"
                : modo === "cita"
                  ? "Guardar cita"
                  : "Bloquear"}
          </Button>
          <Button variant="outline" onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
