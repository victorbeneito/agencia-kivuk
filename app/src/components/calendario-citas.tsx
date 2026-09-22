"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NuevaCitaDialogo, type CitaPrevia } from "@/components/nueva-cita";
import {
  aMinutos,
  diaSemanaDe,
  duracionDe,
  diasDeLaVista,
  franjaDelDia,
  horaEnMadrid,
  fechaEnMadrid,
  instanteEnMadrid,
  minutosEnMadrid,
  sumarDias,
  type Ausencia,
  type Cita,
  type NuevaCita,
  type NuevoBloqueo,
  type ServicioReservable,
  type TrabajadorDeCalendario,
} from "@/lib/citas";

export type Vista = "dia" | "semana";

/**
 * El calendario de citas: rejilla de horas, con una cita en su sitio.
 *
 * Existe porque una lista contesta "qué tengo" pero no "cómo voy": para saber
 * de un vistazo si la semana está llena o hueca hace falta ver el espacio
 * vacío, y el espacio vacío no se puede listar.
 *
 * Dos vistas, y cada una responde a una pregunta distinta:
 *
 *   - **Día**: una columna por trabajadora. Es la de la mañana, cuando se mira
 *     a qué se enfrenta uno hoy y quién tiene el hueco de las cinco.
 *   - **Semana**: una columna por día, y dentro, una subcolumna por
 *     trabajadora. Es la de "cómo vengo de carga".
 *
 * Lo que en otros calendarios es la parte difícil —colocar citas que se
 * solapan— aquí no existe: cada cita va en la subcolumna de SU trabajadora, y
 * dos citas de la misma persona a la misma hora las impide la base de datos.
 * Por eso esto es una rejilla y no un motor de layout.
 */

/** Alto de una hora, en píxeles. Con 56 cabe una jornada partida sin scroll. */
const ALTO_HORA = 56;

/**
 * Alto de la fila de títulos, en píxeles.
 *
 * Es una constante y no un `pt-6` a ojo porque la regla de horas y las columnas
 * son dos elementos distintos que tienen que empezar EXACTAMENTE a la misma
 * altura: si no cuadran, todas las horas quedan desplazadas unos píxeles
 * respecto a las citas, y eso no se ve como un error de maquetación sino como
 * una cita que parece estar a otra hora.
 */
const ALTO_CABECERA = 26;

/** Un color por trabajadora, estable por posición en la lista. */
const COLORES = [
  { fondo: "bg-[#8EB9C5]/25", borde: "border-l-[#3b7686]", texto: "text-[#2c5a68]" },
  { fondo: "bg-[#D0BC82]/30", borde: "border-l-[#8a762c]", texto: "text-[#6b5c22]" },
  { fondo: "bg-[#B45831]/18", borde: "border-l-[#B45831]", texto: "text-[#8e4526]" },
  { fondo: "bg-emerald-500/15", borde: "border-l-emerald-600", texto: "text-emerald-800" },
  { fondo: "bg-violet-500/15", borde: "border-l-violet-600", texto: "text-violet-800" },
];

const DIAS_CORTOS = ["", "L", "M", "X", "J", "V", "S", "D"];

/**
 * Lista, día o semana. Vive fuera del calendario porque desde el calendario
 * hay que poder volver a la lista, y un selector que solo conociera sus dos
 * vistas dejaría a la lista sin camino de vuelta.
 */
export function SelectorDeVista({
  base,
  vista,
  fecha,
}: {
  base: string;
  vista: Vista | "lista";
  fecha: string;
}) {
  const opciones: { clave: Vista | "lista"; texto: string }[] = [
    { clave: "lista", texto: "Lista" },
    { clave: "dia", texto: "Día" },
    { clave: "semana", texto: "Semana" },
  ];

  return (
    <div className="flex overflow-hidden rounded-lg border">
      {opciones.map((o) => (
        <Link
          key={o.clave}
          href={`${base}?vista=${o.clave}&fecha=${fecha}`}
          className={cn(
            "px-3 py-1 text-sm transition-colors",
            o.clave === vista ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          {o.texto}
        </Link>
      ))}
    </div>
  );
}

export function CalendarioCitas({
  vista,
  fecha,
  citas,
  ausencias,
  trabajadores,
  servicios,
  base,
  crear,
  bloquear,
  quitarBloqueo,
  mover,
  cancelar,
}: {
  vista: Vista;
  /** El día que se mira, o cualquiera de la semana que se mira. */
  fecha: string;
  citas: Cita[];
  ausencias: Ausencia[];
  trabajadores: TrabajadorDeCalendario[];
  servicios: ServicioReservable[];
  /** Ruta sobre la que se construyen los enlaces de navegación. */
  base: string;
  /** Si no se pasa, el calendario es de solo lectura. */
  crear?: (datos: NuevaCita) => Promise<{ ok: boolean; mensaje?: string }>;
  bloquear?: (datos: NuevoBloqueo) => Promise<{ ok: boolean; mensaje?: string }>;
  quitarBloqueo?: (id: string) => Promise<{ ok: boolean; mensaje?: string }>;
  /** Si no se pasa, las citas no se pueden arrastrar. */
  mover?: (
    citaId: string,
    staffId: string,
    inicio: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  /** Si no se pasa, la ficha de la cita no ofrece cancelarla. */
  cancelar?: (citaId: string) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const [abierta, setAbierta] = useState<Cita | null>(null);
  const [nueva, setNueva] = useState<CitaPrevia | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [avisoMover, setAvisoMover] = useState("");

  const dias = diasDeLaVista(vista, fecha);

  const franja = franjaDelDia(trabajadores, dias.map(diaSemanaDe));
  const totalMin = franja.hasta - franja.desde;
  const alto = (totalMin / 60) * ALTO_HORA;

  const horas: number[] = [];
  for (let m = franja.desde; m <= franja.hasta; m += 60) horas.push(m);

  const hoy = fechaEnMadrid(new Date().toISOString());

  // Las columnas: en vista día son las trabajadoras; en semana, los días.
  const columnas =
    vista === "dia"
      ? trabajadores.map((t) => ({ clave: t.id, titulo: t.nombre, fecha, trabajadores: [t] }))
      : dias.map((d) => ({
          clave: d,
          titulo: tituloColumna(d),
          fecha: d,
          trabajadores,
        }));

  const salto = vista === "dia" ? 1 : 7;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={vista === "dia" ? "Día anterior" : "Semana anterior"}
            render={<Link href={enlace(base, vista, sumarDias(fecha, -salto))} />}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" render={<Link href={enlace(base, vista, hoy)} />}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={vista === "dia" ? "Día siguiente" : "Semana siguiente"}
            render={<Link href={enlace(base, vista, sumarDias(fecha, salto))} />}
          >
            <ChevronRight className="size-4" />
          </Button>

          <p className="ml-2 text-sm font-medium">
            {vista === "dia" ? tituloLargo(fecha) : rangoSemana(dias)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Saltar a una fecha cualquiera: con flechas solas, ver el mes que
              viene son cinco clics. */}
          <SaltoAFecha base={base} vista={vista} fecha={fecha} />

          {crear && trabajadores.length ? (
            <Button
              size="sm"
              onClick={() =>
                setNueva({
                  staff_id: trabajadores[0].id,
                  fecha: vista === "dia" ? fecha : dias[0],
                  hora: etiquetaHora(franja.desde),
                })
              }
            >
              <Plus className="size-4" />
              Nueva cita
            </Button>
          ) : null}
        </div>
      </div>

      {!trabajadores.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay ningún trabajador activo, así que no hay agenda que dibujar.
        </p>
      ) : (
        /* Alto propio y desplazamiento dentro de la caja: una jornada larga no
           puede empujar la página entera hacia abajo, y con la cabecera pegada
           arriba se ve de quién es cada columna aunque se baje a las ocho de la
           tarde. Antes la cabecera se cortaba al desplazarse, que es justo lo
           que hace que una rejilla deje de leerse. */
        <div className="overflow-x-auto rounded-lg border">
          {/* `py-2` no es margen decorativo: las etiquetas de hora van centradas
              sobre su línea, así que la primera y la última sobresalen medio
              renglón. Sin ese hueco desbordan la caja, aparece una barra de
              desplazamiento de siete píxeles y la primera hora se ve cortada
              aunque estés arriba del todo. */}
          <div className="flex min-w-[38rem] py-2">
            {/* La regla de horas, pegada a la izquierda para que no se pierda
                al desplazarse de lado en la vista semana. */}
            <div className="sticky left-0 z-30 w-12 shrink-0 bg-card">
              {/* Solo reserva el alto de la fila de títulos. Sin fondo ni
                  capa: llevaba `bg-card` y `z-30`, y eso pintaba blanco por
                  encima de la mitad de la etiqueta "10:00", que sobresale
                  hacia arriba por ir centrada en su línea. Se veía como una
                  hora cortada, no como un elemento tapando a otro. */}
              <div style={{ height: ALTO_CABECERA }} />
              <div className="relative" style={{ height: alto }}>
                {horas.map((m) => (
                  <span
                    key={m}
                    className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                    style={{ top: ((m - franja.desde) / totalMin) * 100 + "%" }}
                  >
                    {etiquetaHora(m)}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-1">
              {columnas.map((col) => (
                <div key={col.clave} className="min-w-0 flex-1 border-l first:border-l-0">
                  {/* Pegada arriba: con la jornada entera a la vista hay que
                      poder desplazarse por las horas sin perder de vista de
                      quién es cada columna. */}
                  <p
                    className={cn(
                      "sticky top-0 z-20 flex items-center justify-center truncate bg-card px-1 text-center text-xs font-medium",
                      col.fecha === hoy && vista === "semana"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                    style={{ height: ALTO_CABECERA }}
                    title={col.titulo}
                  >
                    {col.titulo}
                  </p>

                  <div
                    className="relative"
                    style={{ height: alto }}
                    // Soltar aquí mueve la cita. El destino sale de dónde se
                    // suelta: la X dice de quién es la columna (en la vista
                    // semana cada día lleva dentro a todo el equipo) y la Y, la
                    // hora, redondeada a cuartos.
                    onDragOver={mover ? (e) => e.preventDefault() : undefined}
                    onDrop={
                      mover
                        ? (e) => {
                            e.preventDefault();
                            const citaId = e.dataTransfer.getData("text/plain");
                            setArrastrando(null);
                            if (!citaId) return;

                            const caja = e.currentTarget.getBoundingClientRect();
                            const parteY = (e.clientY - caja.top) / caja.height;
                            const minuto =
                              franja.desde + Math.round((parteY * totalMin) / 15) * 15;

                            const cuantos = col.trabajadores.length;
                            const indice = Math.min(
                              cuantos - 1,
                              Math.max(
                                0,
                                Math.floor(((e.clientX - caja.left) / caja.width) * cuantos)
                              )
                            );
                            const destino = col.trabajadores[indice];
                            if (!destino) return;

                            setAvisoMover("");
                            mover(
                              citaId,
                              destino.id,
                              instanteEnMadrid(col.fecha, comoHora(minuto))
                            ).then((r) => {
                              if (!r.ok) setAvisoMover(r.mensaje ?? "No se ha podido mover.");
                            });
                          }
                        : undefined
                    }
                  >
                    {/* Pulsar el hueco: la forma natural de dar una cita en un
                        calendario es señalar dónde va. Se redondea a cuartos de
                        hora, que es como se habla en un salón. */}
                    {crear
                      ? col.trabajadores.map((t, i) => (
                          <button
                            key={`hueco-${t.id}`}
                            type="button"
                            aria-label={`Dar cita con ${t.nombre}`}
                            className="absolute inset-y-0 cursor-copy"
                            style={{
                              left: (i / col.trabajadores.length) * 100 + "%",
                              width: 100 / col.trabajadores.length + "%",
                            }}
                            onClick={(e) => {
                              const caja = e.currentTarget.getBoundingClientRect();
                              const parte = (e.clientY - caja.top) / caja.height;
                              const minuto =
                                franja.desde + Math.round((parte * totalMin) / 15) * 15;
                              setNueva({
                                staff_id: t.id,
                                fecha: col.fecha,
                                hora: comoHora(Math.min(minuto, franja.hasta - 15)),
                              });
                            }}
                          />
                        ))
                      : null}

                    {/* Horario y horas muertas */}
                    {col.trabajadores.map((t, i) => (
                      <Fondo
                        key={t.id}
                        trabajador={t}
                        fecha={col.fecha}
                        franja={franja}
                        izquierda={(i / col.trabajadores.length) * 100}
                        ancho={100 / col.trabajadores.length}
                      />
                    ))}

                    {/* Las líneas de las horas, por encima del fondo */}
                    {horas.map((m) => (
                      <div
                        key={m}
                        className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                        style={{ top: ((m - franja.desde) / totalMin) * 100 + "%" }}
                      />
                    ))}

                    {/* Los bloqueos van antes que las citas: si por lo que sea
                        coinciden, la cita manda a la vista. */}
                    {col.trabajadores.map((t, i) =>
                      ausencias
                        .filter((a) => a.staff_id === t.id)
                        .map((a) => (
                          <CajaBloqueo
                            key={a.id}
                            ausencia={a}
                            fecha={col.fecha}
                            franja={franja}
                            izquierda={(i / col.trabajadores.length) * 100}
                            ancho={100 / col.trabajadores.length}
                            onQuitar={quitarBloqueo}
                          />
                        ))
                    )}

                    {col.trabajadores.map((t, i) =>
                      citas
                        .filter(
                          (c) =>
                            c.staff_id === t.id && fechaEnMadrid(c.inicio) === col.fecha
                        )
                        .map((c) => (
                          <CajaCita
                            key={c.id}
                            cita={c}
                            color={COLORES[indiceDe(trabajadores, t.id) % COLORES.length]}
                            franja={franja}
                            izquierda={(i / col.trabajadores.length) * 100}
                            ancho={100 / col.trabajadores.length}
                            compacta={vista === "semana"}
                            onAbrir={() => setAbierta(c)}
                            arrastrable={Boolean(mover)}
                            arrastrando={arrastrando === c.id}
                            onEmpezarArrastre={() => setArrastrando(c.id)}
                            onTerminarArrastre={() => setArrastrando(null)}
                          />
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {avisoMover ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {avisoMover}
        </p>
      ) : null}

      {vista === "semana" && trabajadores.length > 1 ? (
        <div className="flex flex-wrap gap-3">
          {trabajadores.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn("size-3 rounded-sm border-l-2", COLORES[i % COLORES.length].fondo, COLORES[i % COLORES.length].borde)}
              />
              {t.nombre}
            </span>
          ))}
        </div>
      ) : null}

      {abierta ? (
        <Detalle cita={abierta} cancelar={cancelar} onCerrar={() => setAbierta(null)} />
      ) : null}

      {nueva && crear ? (
        <NuevaCitaDialogo
          previa={nueva}
          trabajadores={trabajadores}
          servicios={servicios}
          crear={crear}
          bloquear={bloquear}
          onCerrar={() => setNueva(null)}
        />
      ) : null}
    </div>
  );
}

function indiceDe(trabajadores: TrabajadorDeCalendario[], id: string) {
  const i = trabajadores.findIndex((t) => t.id === id);
  return i === -1 ? 0 : i;
}

/**
 * El horario de esa persona ese día, pintado como fondo.
 *
 * Sin esto, un hueco a las 15:00 y un hueco a las 15:00 de un día que libra se
 * ven igual, y son cosas opuestas: uno se puede vender y el otro no.
 */
function Fondo({
  trabajador,
  fecha,
  franja,
  izquierda,
  ancho,
}: {
  trabajador: TrabajadorDeCalendario;
  fecha: string;
  franja: { desde: number; hasta: number };
  izquierda: number;
  ancho: number;
}) {
  const dia = diaSemanaDe(fecha);
  const total = franja.hasta - franja.desde;
  const tramos = trabajador.horario.filter((t) => t.dia === dia);

  return (
    <>
      <div
        className="absolute inset-y-0 bg-muted/40"
        style={{ left: izquierda + "%", width: ancho + "%" }}
      />
      {tramos.map((t, i) => (
        <div
          key={i}
          className="absolute bg-card"
          style={{
            left: izquierda + "%",
            width: ancho + "%",
            top: ((aMinutos(t.inicio) - franja.desde) / total) * 100 + "%",
            height: ((aMinutos(t.fin) - aMinutos(t.inicio)) / total) * 100 + "%",
          }}
        />
      ))}
    </>
  );
}

function CajaCita({
  cita,
  color,
  franja,
  izquierda,
  ancho,
  compacta,
  onAbrir,
  arrastrable,
  arrastrando,
  onEmpezarArrastre,
  onTerminarArrastre,
}: {
  cita: Cita;
  color: (typeof COLORES)[number];
  franja: { desde: number; hasta: number };
  izquierda: number;
  ancho: number;
  compacta: boolean;
  onAbrir: () => void;
  arrastrable?: boolean;
  arrastrando?: boolean;
  onEmpezarArrastre?: () => void;
  onTerminarArrastre?: () => void;
}) {
  const total = franja.hasta - franja.desde;
  const inicio = minutosEnMadrid(cita.inicio);
  const duracion = duracionDe(cita);

  // Una cita de 15 minutos mide 14 píxeles: se recorta para que el texto quepa
  // y no se convierta en una raya que no se puede ni pulsar.
  const altoReal = Math.max((duracion / total) * 100, (18 / ((total / 60) * ALTO_HORA)) * 100);

  return (
    <button
      type="button"
      onClick={onAbrir}
      draggable={arrastrable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", cita.id);
        e.dataTransfer.effectAllowed = "move";
        onEmpezarArrastre?.();
      }}
      onDragEnd={() => onTerminarArrastre?.()}
      title={`${horaEnMadrid(cita.inicio)} · ${cita.nombre_contacto || "Sin nombre"}`}
      className={cn(
        "absolute overflow-hidden rounded-sm border-l-2 px-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
        arrastrable && "cursor-grab active:cursor-grabbing",
        arrastrando && "opacity-40",
        color.fondo,
        color.borde,
        color.texto
      )}
      style={{
        left: `calc(${izquierda}% + 1px)`,
        width: `calc(${ancho}% - 2px)`,
        top: ((inicio - franja.desde) / total) * 100 + "%",
        height: altoReal + "%",
      }}
    >
      <span className="block truncate font-medium tabular-nums">
        {horaEnMadrid(cita.inicio)}
        {compacta ? "" : ` · ${cita.nombre_contacto || "Sin nombre"}`}
      </span>
      {!compacta && cita.servicios.length ? (
        <span className="block truncate">
          {cita.servicios.map((s) => s.nombre).join(" + ")}
        </span>
      ) : null}
      {compacta ? (
        <span className="block truncate">{cita.nombre_contacto || "Sin nombre"}</span>
      ) : null}
    </button>
  );
}

/**
 * Un rato tapado: vacaciones, el médico, una formación.
 *
 * Se dibuja a rayas y sin color de nadie, para que no se confunda ni un segundo
 * con una cita. Lo que importa de un bloqueo no es quién viene —no viene
 * nadie— sino que ahí no se puede meter a nadie.
 *
 * Se recorta a la franja visible: una semana de vacaciones empieza el lunes a
 * las 00:00 y si se dibujara entera se saldría por arriba en todos los días.
 */
function CajaBloqueo({
  ausencia,
  fecha,
  franja,
  izquierda,
  ancho,
  onQuitar,
}: {
  ausencia: Ausencia;
  fecha: string;
  franja: { desde: number; hasta: number };
  izquierda: number;
  ancho: number;
  onQuitar?: (id: string) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const [quitando, setQuitando] = useState(false);
  const total = franja.hasta - franja.desde;

  // Se recorta a lo que cae dentro de ESTE día y de la franja que se dibuja.
  // Una semana de vacaciones es un solo bloqueo que va del lunes a las 00:00 al
  // sábado a las 00:00: en cada día hay que pintar el trozo que le toca.
  //
  // Los infinitos hacen el trabajo de los cuatro `if` que había aquí antes: si
  // el bloqueo empieza después de hoy o acabó antes, el trozo sale vacío y no
  // se dibuja nada, sin tener que enumerar los casos.
  const diaInicio = fechaEnMadrid(ausencia.inicio);
  const diaFin = fechaEnMadrid(ausencia.fin);

  const desde =
    diaInicio < fecha ? franja.desde
    : diaInicio === fecha ? minutosEnMadrid(ausencia.inicio)
    : Infinity;

  const hasta =
    diaFin > fecha ? franja.hasta
    : diaFin === fecha ? minutosEnMadrid(ausencia.fin)
    : -Infinity;

  const arriba = Math.max(desde, franja.desde);
  const abajo = Math.min(hasta, franja.hasta);
  if (!(abajo > arriba)) return null;

  return (
    <div
      className="absolute overflow-hidden rounded-sm border border-dashed border-muted-foreground/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(120,120,120,0.16)_5px,rgba(120,120,120,0.16)_10px)] px-1 text-[11px] leading-tight text-muted-foreground"
      style={{
        left: `calc(${izquierda}% + 1px)`,
        width: `calc(${ancho}% - 2px)`,
        top: ((arriba - franja.desde) / total) * 100 + "%",
        height: ((abajo - arriba) / total) * 100 + "%",
      }}
      title={ausencia.motivo || "Bloqueado"}
    >
      <span className="block truncate font-medium">
        {ausencia.motivo || "Bloqueado"}
      </span>
      {onQuitar ? (
        <button
          type="button"
          className="absolute right-0.5 top-0.5 rounded bg-card/80 px-1 text-[10px] hover:bg-card"
          disabled={quitando}
          onClick={async (e) => {
            e.stopPropagation();
            setQuitando(true);
            await onQuitar(ausencia.id);
            setQuitando(false);
          }}
          aria-label="Quitar el bloqueo"
        >
          {quitando ? "…" : "✕"}
        </button>
      ) : null}
    </div>
  );
}

/** La ficha de una cita. Un panel abajo, no un diálogo: se cierra tocando fuera. */
function Detalle({
  cita,
  cancelar,
  onCerrar,
}: {
  cita: Cita;
  cancelar?: (citaId: string) => Promise<{ ok: boolean; mensaje?: string }>;
  onCerrar: () => void;
}) {
  const [enCurso, empezar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");

  // Con quince citas en un día, ir a la lista a buscar la que ya tienes delante
  // en el cuadrante es dar un rodeo. La confirmación va en el propio botón, como
  // en la lista: cancelar no avisa a nadie y no se deshace, pero se decide en un
  // segundo y un diálogo encima de otro sería un salto más en el móvil.
  // Se mira una vez, al abrir la ficha. Si pasa mientras está abierta, la
  // acción del servidor lo rechaza igual con su propio mensaje.
  const [pasada] = useState(() => new Date(cita.fin).getTime() < Date.now());

  function onCancelar() {
    if (!cancelar) return;
    setError("");
    empezar(async () => {
      const r = await cancelar(cita.id);
      if (r.ok) onCerrar();
      else {
        setError(r.mensaje ?? "No se ha podido cancelar.");
        setConfirmando(false);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Detalle de la cita"
      >
        <p className="text-lg font-medium tabular-nums">
          {horaEnMadrid(cita.inicio)} – {horaEnMadrid(cita.fin)}
        </p>
        <p className="text-sm text-muted-foreground">
          {new Date(`${fechaEnMadrid(cita.inicio)}T12:00:00Z`).toLocaleDateString("es-ES", {
            timeZone: "UTC",
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>

        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Quién</dt>
            <dd>{cita.nombre_contacto || "Sin nombre"}</dd>
          </div>
          {cita.contacto ? (
            <div>
              <dt className="text-xs text-muted-foreground">Teléfono</dt>
              <dd>
                <a className="underline" href={`tel:${cita.contacto}`}>
                  {cita.contacto}
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">Qué</dt>
            <dd>
              {cita.servicios.length
                ? cita.servicios.map((s) => s.nombre).join(" + ")
                : "Sin servicio anotado"}
            </dd>
          </div>
          {cita.trabajador ? (
            <div>
              <dt className="text-xs text-muted-foreground">Con</dt>
              <dd>{cita.trabajador}</dd>
            </div>
          ) : null}
          {cita.notas ? (
            <div>
              <dt className="text-xs text-muted-foreground">Notas</dt>
              <dd>{cita.notas}</dd>
            </div>
          ) : null}
        </dl>

        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

        {cancelar && !pasada ? (
          confirmando ? (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-sm">¿Cancelar esta cita? Su hueco vuelve a quedar libre.</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={onCancelar}
                  disabled={enCurso}
                >
                  {enCurso ? "Cancelando…" : "Sí, cancelarla"}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setConfirmando(false)}
                  disabled={enCurso}
                >
                  No
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setConfirmando(true)}
              >
                Cancelar cita
              </Button>
              <Button className="flex-1" variant="outline" onClick={onCerrar}>
                Cerrar
              </Button>
            </div>
          )
        ) : (
          <Button className="mt-4 w-full" variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        )}
      </div>
    </div>
  );
}

function SaltoAFecha({ base, vista, fecha }: { base: string; vista: Vista; fecha: string }) {
  return (
    <input
      type="date"
      value={fecha}
      // Navegación normal, sin router: la fecha vive en la URL, así que cambiarla
      // es ir a otra dirección.
      onChange={(e) => {
        if (e.target.value) window.location.href = enlace(base, vista, e.target.value);
      }}
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
      aria-label="Ir a una fecha"
    />
  );
}

function enlace(base: string, vista: Vista, fecha: string) {
  return `${base}?vista=${vista}&fecha=${fecha}`;
}

/** Minutos desde medianoche -> "HH:MM". La etiqueta de la regla solo da horas. */
function comoHora(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function etiquetaHora(minutos: number) {
  return String(Math.floor(minutos / 60)).padStart(2, "0") + ":00";
}

function tituloColumna(fecha: string) {
  const dia = DIAS_CORTOS[diaSemanaDe(fecha)];
  return `${dia} ${Number(fecha.slice(8, 10))}`;
}

function tituloLargo(fecha: string) {
  const t = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function rangoSemana(dias: string[]) {
  const primero = new Date(`${dias[0]}T12:00:00Z`);
  const ultimo = new Date(`${dias[dias.length - 1]}T12:00:00Z`);
  const mesPrimero = primero.toLocaleDateString("es-ES", { timeZone: "UTC", month: "long" });
  const mesUltimo = ultimo.toLocaleDateString("es-ES", { timeZone: "UTC", month: "long" });

  return mesPrimero === mesUltimo
    ? `${primero.getUTCDate()} – ${ultimo.getUTCDate()} de ${mesUltimo}`
    : `${primero.getUTCDate()} de ${mesPrimero} – ${ultimo.getUTCDate()} de ${mesUltimo}`;
}
