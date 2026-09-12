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
  /** Para colocarla en la columna de su trabajadora en el calendario. */
  staff_id: string;
  trabajador: string;
  servicios: ServicioDeCita[];
};

/** Un tramo de trabajo, para pintar en el calendario lo que es horario y lo que no. */
export type TramoTrabajador = {
  dia: number;
  inicio: string;
  fin: string;
};

export type TrabajadorDeCalendario = {
  id: string;
  nombre: string;
  horario: TramoTrabajador[];
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
  staff_id: string;
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
      "id, staff_id, inicio, fin, estado, nombre_contacto, contacto, email, notas, " +
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
    staff_id: f.staff_id,
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

// === El calendario ===========================================================

/** Suma días a una fecha "YYYY-MM-DD" sin que el cambio de hora la mueva. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes ... 7 = domingo, igual que `staff_hours`. */
export function diaSemanaDe(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** El lunes de la semana de esa fecha. La semana empieza en lunes, como aquí. */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -(diaSemanaDe(fecha) - 1));
}

/** Hoy, en Madrid. */
export function hoyEnMadrid(): string {
  return fechaEnMadrid(new Date().toISOString());
}

/** "2026-09-15" si es válida; si no, hoy. Lo que llega por la URL no es de fiar. */
export function fechaValida(valor: string | undefined): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor))
    ? valor
    : hoyEnMadrid();
}

/** Minutos desde medianoche de una hora "HH:MM". */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Los minutos desde medianoche de un instante, en hora de Madrid. */
export function minutosEnMadrid(iso: string): number {
  return aMinutos(horaEnMadrid(iso));
}

/**
 * Las citas confirmadas entre dos fechas (las dos incluidas).
 *
 * Aparte de `citasProximas` porque responde a otra pregunta: aquella es "qué
 * tengo por delante" y esta es "qué hay en estos días concretos", que es lo que
 * pide un calendario al que se puede navegar.
 */
export async function citasEntre(
  supabase: SupabaseClient,
  clientId: string,
  desde: string,
  hasta: string
): Promise<Cita[]> {
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, staff_id, inicio, fin, estado, nombre_contacto, contacto, email, notas, " +
        "staff(nombre), appointment_services(nombre, duracion_min, posicion)"
    )
    .eq("client_id", clientId)
    .eq("estado", "confirmada")
    // Un margen de un día por cada lado y después se filtra por la fecha ya
    // convertida a Madrid: en invierno, las 00:30 de Madrid son del día
    // anterior en UTC, y una consulta por el borde exacto se dejaría esa cita.
    .gte("inicio", `${sumarDias(desde, -1)}T00:00:00Z`)
    .lte("inicio", `${sumarDias(hasta, 1)}T00:00:00Z`)
    .order("inicio");

  return ((data ?? []) as unknown as FilaCita[])
    .map((f) => ({
      id: f.id,
      inicio: f.inicio,
      fin: f.fin,
      estado: f.estado,
      nombre_contacto: (f.nombre_contacto ?? "").trim(),
      contacto: (f.contacto ?? "").trim(),
      email: f.email,
      notas: (f.notas ?? "").trim(),
      staff_id: f.staff_id,
      trabajador: Array.isArray(f.staff)
        ? f.staff[0]?.nombre ?? ""
        : f.staff?.nombre ?? "",
      servicios: (f.appointment_services ?? [])
        .slice()
        .sort((a, b) => a.posicion - b.posicion)
        .map((s) => ({ nombre: s.nombre, duracion_min: s.duracion_min })),
    }))
    .filter((c) => {
      const fecha = fechaEnMadrid(c.inicio);
      return fecha >= desde && fecha <= hasta;
    });
}

/** Quién atiende, con su horario, para dibujar las columnas y las horas muertas. */
export async function trabajadoresDeCalendario(
  supabase: SupabaseClient,
  clientId: string
): Promise<TrabajadorDeCalendario[]> {
  const { data } = await supabase
    .from("staff")
    .select("id, nombre, staff_hours(dia_semana, hora_inicio, hora_fin)")
    .eq("client_id", clientId)
    .eq("activo", true)
    .order("orden")
    .order("created_at");

  type Fila = {
    id: string;
    nombre: string;
    staff_hours: { dia_semana: number; hora_inicio: string; hora_fin: string }[] | null;
  };

  return ((data ?? []) as unknown as Fila[]).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    horario: (t.staff_hours ?? []).map((h) => ({
      dia: h.dia_semana,
      inicio: h.hora_inicio.slice(0, 5),
      fin: h.hora_fin.slice(0, 5),
    })),
  }));
}

/**
 * De qué hora a qué hora se pinta la rejilla.
 *
 * Del horario real del negocio, no de las 00:00 a las 24:00: un salón que abre
 * de 10 a 20 no necesita ver diez horas vacías para encontrar las suyas. Se
 * redondea a la hora en punto por fuera para que las etiquetas cuadren, y se
 * deja un mínimo por si alguien no tiene horario configurado.
 */
export function franjaDelDia(
  trabajadores: TrabajadorDeCalendario[],
  diasVisibles: number[]
): { desde: number; hasta: number } {
  let desde = Infinity;
  let hasta = -Infinity;

  for (const t of trabajadores) {
    for (const tramo of t.horario) {
      if (!diasVisibles.includes(tramo.dia)) continue;
      desde = Math.min(desde, aMinutos(tramo.inicio));
      hasta = Math.max(hasta, aMinutos(tramo.fin));
    }
  }

  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) {
    return { desde: 9 * 60, hasta: 20 * 60 };
  }

  return {
    desde: Math.floor(desde / 60) * 60,
    hasta: Math.ceil(hasta / 60) * 60,
  };
}

/**
 * Los días que se ven en cada vista.
 *
 * Vive aquí y no en el componente porque la pantalla tiene que pedir a la base
 * exactamente los días que se van a dibujar. Si cada uno lo calculara por su
 * cuenta, el día que uno de los dos cambie aparecerían columnas vacías sin que
 * nada falle.
 *
 * La semana se ancla al lunes: así "siguiente" siempre cae en lunes y la
 * rejilla no baila según desde dónde se navegue.
 */
export function diasDeLaVista(vista: "dia" | "semana", fecha: string): string[] {
  if (vista === "dia") return [fecha];
  const lunes = lunesDe(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/**
 * "2026-09-15" + "10:00" en Madrid -> el instante en UTC.
 *
 * No vale `new Date("2026-09-15T10:00")`: eso usa la zona del servidor, y el
 * VPS va en UTC, así que una cita de las 10:00 se guardaría a las 12:00 de
 * Madrid. Tampoco vale fijar "+02:00", que sería verano todo el año.
 *
 * Se prueban los dos desfases posibles de España y se elige el que, al volver a
 * convertirlo a hora de Madrid, devuelve exactamente la hora pedida. Es la
 * misma idea que usa el motor de agenda en n8n.
 */
export function instanteEnMadrid(fecha: string, hora: string): string {
  for (const desfase of ["+02:00", "+01:00"]) {
    const iso = `${fecha}T${hora}:00${desfase}`;
    if (horaEnMadrid(iso) === hora && fechaEnMadrid(iso) === fecha) {
      return new Date(iso).toISOString();
    }
  }
  // Las dos horas de la madrugada del cambio de hora de octubre existen dos
  // veces; no hay respuesta única y cualquiera de las dos vale. Pasa una vez al
  // año a las tres de la mañana, cuando no hay peluquerías abiertas.
  return new Date(`${fecha}T${hora}:00+01:00`).toISOString();
}

/** Lo que hace falta para crear una cita a mano desde el panel. */
export type NuevaCita = {
  staff_id: string;
  fecha: string;
  hora: string;
  duracion_min: number;
  servicio_id: string | null;
  servicio_nombre: string;
  nombre: string;
  contacto: string;
  notas: string;
};

/** Un servicio del catálogo, para el desplegable del formulario. */
export type ServicioReservable = {
  id: string;
  nombre: string;
  duracion_min: number;
};

export async function serviciosReservables(
  supabase: SupabaseClient,
  clientId: string
): Promise<ServicioReservable[]> {
  const { data } = await supabase
    .from("booking_services")
    .select("id, nombre, duracion_min")
    .eq("client_id", clientId)
    .eq("activo", true)
    .order("orden")
    .order("nombre");

  return (data ?? []) as ServicioReservable[];
}

/**
 * Comprueba una cita nueva y la deja lista para `agenda_reservar`.
 *
 * Vive aquí porque las dos pantallas —la de la agencia y la del cliente— crean
 * citas y tienen que validar lo mismo. Lo que NO se comprueba aquí es el
 * solape: de eso se encarga la restricción de la base, que es la única que no
 * puede perder una carrera entre dos personas guardando a la vez.
 */
export function prepararCita(datos: NuevaCita):
  | { ok: false; mensaje: string }
  | { ok: true; inicio: string; fin: string; servicios: ServicioDeCita[] } {
  if (!datos.staff_id) return { ok: false, mensaje: "Elige con quién es la cita." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return { ok: false, mensaje: "La fecha no es válida." };
  if (!/^\d{2}:\d{2}$/.test(datos.hora)) return { ok: false, mensaje: "La hora no es válida." };

  const duracion = Math.round(Number(datos.duracion_min));
  if (!Number.isFinite(duracion) || duracion < 5 || duracion > 600) {
    return { ok: false, mensaje: "La duración tiene que estar entre 5 y 600 minutos." };
  }

  const inicio = instanteEnMadrid(datos.fecha, datos.hora);
  const fin = new Date(new Date(inicio).getTime() + duracion * 60000).toISOString();

  const nombre = datos.servicio_nombre.trim();

  return {
    ok: true,
    inicio,
    fin,
    servicios: nombre ? [{ nombre, duracion_min: duracion }] : [],
  };
}
