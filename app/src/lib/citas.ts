/**
 * Las citas, leídas igual para los dos paneles.
 *
 * La agencia y el cliente final ven lo mismo con permisos distintos: la agencia
 * por su RLS de agencia, el cliente por la suya de solo lectura (migración
 * 0014). Como la consulta es idéntica, vive aquí y cada pantalla le pasa su
 * propio cliente de Supabase; así no hay dos versiones de "qué es una cita
 * próxima" que se separen con el tiempo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Todo se dice en hora de Madrid, como el resto de la agenda. */
export const ZONA = "Europe/Madrid";

export type ServicioDeCita = {
  nombre: string;
  duracion_min: number;
};

export type Cita = {
  id: string;
  inicio: string;
  fin: string;
  estado: string;
  nombre_contacto: string;
  contacto: string;
  email: string | null;
  notas: string;
  trabajador: string;
  servicios: ServicioDeCita[];
};

export type DiaDeCitas = {
  /** "2026-09-15", en hora de Madrid. */
  fecha: string;
  /** "Hoy, martes 15 de septiembre". */
  titulo: string;
  citas: Cita[];
};

type FilaCita = {
  id: string;
  inicio: string;
  fin: string;
  estado: string;
  nombre_contacto: string | null;
  contacto: string | null;
  email: string | null;
  notas: string | null;
  staff: { nombre: string } | { nombre: string }[] | null;
  appointment_services:
    | { nombre: string; duracion_min: number; posicion: number }[]
    | null;
};

/** El día en Madrid de un instante, como "2026-09-15". */
export function fechaEnMadrid(iso: string): string {
  // `sv-SE` porque su formato de fecha es justo el ISO, y así no hay que
  // recomponer día, mes y año a mano ni preocuparse de los ceros delante.
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: ZONA });
}

/** "10:30" en hora de Madrid. */
export function horaEnMadrid(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * El título de un día: "Hoy", "Mañana" o el nombre del día.
 *
 * Lo de "hoy" y "mañana" no es decoración: quien mira esta pantalla lo hace
 * de pie en el salón para saber qué le queda esta tarde, y tener que traducir
 * "martes 15" a "esto es hoy" es exactamente el trabajo que la pantalla tiene
 * que ahorrar.
 */
export function tituloDeDia(fecha: string, hoy: string): string {
  const largo = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Mañana se calcula sumando un día a la fecha de hoy, no a `Date.now()`:
  // así el cambio de hora no mueve el resultado.
  const manana = new Date(`${hoy}T12:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  const fechaManana = manana.toISOString().slice(0, 10);

  if (fecha === hoy) return `Hoy, ${largo}`;
  if (fecha === fechaManana) return `Mañana, ${largo}`;
  return largo.charAt(0).toUpperCase() + largo.slice(1);
}

/** Cuánto dura la cita entera, en minutos. */
export function duracionDe(cita: Cita): number {
  return Math.round(
    (new Date(cita.fin).getTime() - new Date(cita.inicio).getTime()) / 60000
  );
}

/**
 * Las citas confirmadas desde el principio de hoy.
 *
 * Se empieza en el día entero y no en "ahora" a propósito: a media tarde, la
 * pregunta habitual es tanto "qué me queda" como "quién ha venido esta
 * mañana", y una lista que va borrando lo que acaba de pasar obliga a
 * recordar. Las canceladas no salen: su hueco está libre otra vez y verlas
 * aquí sería confundir la agenda con un historial.
 */
export async function citasProximas(
  supabase: SupabaseClient,
  clientId: string,
  dias = 30
): Promise<DiaDeCitas[]> {
  const hoy = fechaEnMadrid(new Date().toISOString());

  const hasta = new Date(`${hoy}T00:00:00Z`);
  hasta.setUTCDate(hasta.getUTCDate() + dias);

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, inicio, fin, estado, nombre_contacto, contacto, email, notas, " +
        "staff(nombre), appointment_services(nombre, duracion_min, posicion)"
    )
    .eq("client_id", clientId)
    .eq("estado", "confirmada")
    // El día empieza a las 00:00 de Madrid, que en invierno son las 23:00 del
    // día anterior en UTC. Se pide desde un poco antes y se filtra después por
    // la fecha ya convertida, que es la que de verdad decide.
    .gte("inicio", new Date(`${hoy}T00:00:00+02:00`).toISOString())
    .lt("inicio", hasta.toISOString())
    .order("inicio");

  const citas: Cita[] = ((data ?? []) as unknown as FilaCita[]).map((f) => ({
    id: f.id,
    inicio: f.inicio,
    fin: f.fin,
    estado: f.estado,
    nombre_contacto: (f.nombre_contacto ?? "").trim(),
    contacto: (f.contacto ?? "").trim(),
    email: f.email,
    notas: (f.notas ?? "").trim(),
    // PostgREST devuelve el embebido como objeto o como lista según cómo
    // resuelva la relación; se acepta cualquiera de los dos.
    trabajador: Array.isArray(f.staff)
      ? f.staff[0]?.nombre ?? ""
      : f.staff?.nombre ?? "",
    servicios: (f.appointment_services ?? [])
      .slice()
      .sort((a, b) => a.posicion - b.posicion)
      .map((s) => ({ nombre: s.nombre, duracion_min: s.duracion_min })),
  }));

  const porDia = new Map<string, Cita[]>();
  for (const cita of citas) {
    const fecha = fechaEnMadrid(cita.inicio);
    if (fecha < hoy) continue;
    const lista = porDia.get(fecha);
    if (lista) lista.push(cita);
    else porDia.set(fecha, [cita]);
  }

  return [...porDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, lista]) => ({
      fecha,
      titulo: tituloDeDia(fecha, hoy),
      citas: lista,
    }));
}
