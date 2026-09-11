"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  aMinutos,
  diaSemanaDe,
  duracionDe,
  diasDeLaVista,
  franjaDelDia,
  horaEnMadrid,
  fechaEnMadrid,
  minutosEnMadrid,
  sumarDias,
  type Cita,
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
  trabajadores,
  base,
}: {
  vista: Vista;
  /** El día que se mira, o cualquiera de la semana que se mira. */
  fecha: string;
  citas: Cita[];
  trabajadores: TrabajadorDeCalendario[];
  /** Ruta sobre la que se construyen los enlaces de navegación. */
  base: string;
}) {
  const [abierta, setAbierta] = useState<Cita | null>(null);

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

        {/* Saltar a una fecha cualquiera: con flechas solas, ver el mes que
            viene son cinco clics. */}
        <SaltoAFecha base={base} vista={vista} fecha={fecha} />
      </div>

      {!trabajadores.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay ningún trabajador activo, así que no hay agenda que dibujar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[38rem]">
            {/* La regla de horas */}
            <div className="w-12 shrink-0 pt-6">
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
                  <p
                    className={cn(
                      "truncate px-1 pb-1 text-center text-xs font-medium",
                      col.fecha === hoy && vista === "semana"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {col.titulo}
                  </p>

                  <div className="relative" style={{ height: alto }}>
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

      {abierta ? <Detalle cita={abierta} onCerrar={() => setAbierta(null)} /> : null}
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
}: {
  cita: Cita;
  color: (typeof COLORES)[number];
  franja: { desde: number; hasta: number };
  izquierda: number;
  ancho: number;
  compacta: boolean;
  onAbrir: () => void;
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
      title={`${horaEnMadrid(cita.inicio)} · ${cita.nombre_contacto || "Sin nombre"}`}
      className={cn(
        "absolute overflow-hidden rounded-sm border-l-2 px-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
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

/** La ficha de una cita. Un panel abajo, no un diálogo: se cierra tocando fuera. */
function Detalle({ cita, onCerrar }: { cita: Cita; onCerrar: () => void }) {
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

        <Button className="mt-4 w-full" variant="outline" onClick={onCerrar}>
          Cerrar
        </Button>
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
