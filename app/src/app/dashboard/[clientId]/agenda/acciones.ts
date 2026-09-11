"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { DIAS_SEMANA, horarioInicial, type Tramo } from "@/lib/agenda";
import { normalizarNombre, parsearServicios } from "@/lib/agenda-csv";

/**
 * Todo lo que escribe la agenda desde el panel de la agencia.
 *
 * Se usa el cliente normal de Supabase, el que respeta RLS, igual que en
 * facturación: aquí no hay ninguna escritura que un `agency_admin` no pueda
 * hacer por sí mismo, así que las políticas de la 0014 son la frontera y no hay
 * que reimplementar los permisos a mano.
 *
 * El día que estas pantallas se abran al cliente final habrá que cambiarlo: el
 * `client_user` solo tiene SELECT, y sus escrituras van con `service_role` y
 * comprobación explícita de permisos.
 */

export type Resultado = { ok: boolean; mensaje: string };

const HORA = /^\d{2}:\d{2}$/;

/**
 * Lee del formulario los tramos de los siete días.
 *
 * La pantalla ofrece dos tramos por día (mañana y tarde), que es lo que tiene
 * un negocio con horario partido. La tabla admite los que hagan falta, así que
 * ampliar la pantalla no pide migración.
 */
function leerHorario(formData: FormData): Tramo[] | string {
  const tramos: Tramo[] = [];

  for (const { valor, nombre } of DIAS_SEMANA) {
    if (!formData.get(`dia_${valor}`)) continue;

    const dia = parseInt(valor, 10);
    let algunTramo = false;

    for (const parte of ["manana", "tarde"] as const) {
      const inicio = String(formData.get(`${parte}_inicio_${valor}`) ?? "").trim();
      const fin = String(formData.get(`${parte}_fin_${valor}`) ?? "").trim();

      // Medio tramo no es un horario: o están las dos horas o no está ninguna.
      if (!inicio && !fin) continue;
      if (!HORA.test(inicio) || !HORA.test(fin)) {
        return `${nombre}: falta una de las dos horas.`;
      }
      if (fin <= inicio) {
        return `${nombre}: la hora de fin (${fin}) tiene que ser posterior a la de inicio (${inicio}).`;
      }

      tramos.push({ dia, inicio, fin });
      algunTramo = true;
    }

    if (!algunTramo) {
      return `${nombre} está marcado como día de trabajo pero no tiene horas.`;
    }
  }

  return tramos;
}

/** Cambia el horario de un trabajador por el que se le pasa. */
async function reemplazarHorario(staffId: string, tramos: Tramo[]) {
  const supabase = await createClient();

  // El borrado va después de haber validado todo (`leerHorario` ya ha dicho que
  // sí): si se borrase antes y fallara el alta, el trabajador se quedaría sin
  // horario, que en esta tabla significa "no trabaja nunca".
  const { error: errorBorrado } = await supabase
    .from("staff_hours")
    .delete()
    .eq("staff_id", staffId);

  if (errorBorrado) return errorBorrado.message;

  if (!tramos.length) return null;

  const { error } = await supabase.from("staff_hours").insert(
    tramos.map((t) => ({
      staff_id: staffId,
      dia_semana: t.dia,
      hora_inicio: t.inicio,
      hora_fin: t.fin,
    }))
  );

  return error?.message ?? null;
}

// === Trabajadores ===

export async function crearTrabajador(formData: FormData): Promise<Resultado> {
  const clientId = String(formData.get("client_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const calendarId = String(formData.get("calendar_id") ?? "").trim();

  if (!nombre) return { ok: false, mensaje: "Ponle un nombre al trabajador." };

  const supabase = await createClient();

  const { data: modulo } = await supabase
    .from("client_modules")
    .select("config")
    .eq("client_id", clientId)
    .eq("module", "calendar")
    .maybeSingle();

  const { data: creado, error } = await supabase
    .from("staff")
    .insert({
      client_id: clientId,
      nombre,
      calendar_id: calendarId || null,
    })
    .select("id")
    .single();

  if (error || !creado) {
    return { ok: false, mensaje: `No se pudo crear: ${error?.message}` };
  }

  // Nace con el horario del negocio para que no quede invisible para el bot.
  const errorHorario = await reemplazarHorario(
    creado.id,
    horarioInicial((modulo?.config as Record<string, string> | null) ?? null)
  );

  revalidatePath(`/dashboard/${clientId}/agenda`);

  if (errorHorario) {
    return {
      ok: false,
      mensaje: `${nombre} se ha creado, pero sin horario: ${errorHorario}`,
    };
  }

  return {
    ok: true,
    mensaje: `${nombre} añadido, con el horario del negocio. Ajústaselo si el suyo es otro.`,
  };
}

export async function guardarTrabajador(formData: FormData): Promise<Resultado> {
  const clientId = String(formData.get("client_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const calendarId = String(formData.get("calendar_id") ?? "").trim();
  const activo = formData.get("activo") === "si";

  if (!nombre) return { ok: false, mensaje: "El nombre no puede quedar vacío." };

  const tramos = leerHorario(formData);
  if (typeof tramos === "string") return { ok: false, mensaje: tramos };

  const supabase = await createClient();

  const { error } = await supabase
    .from("staff")
    .update({ nombre, calendar_id: calendarId || null, activo })
    .eq("id", staffId);

  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };

  const errorHorario = await reemplazarHorario(staffId, tramos);
  if (errorHorario) {
    return { ok: false, mensaje: `No se pudo guardar el horario: ${errorHorario}` };
  }

  revalidatePath(`/dashboard/${clientId}/agenda`);

  if (!tramos.length) {
    return {
      ok: true,
      mensaje: `${nombre} guardado, pero sin ningún día marcado: el bot no le dará citas.`,
    };
  }

  return { ok: true, mensaje: `${nombre} guardado.` };
}

export async function borrarTrabajador(
  clientId: string,
  staffId: string
): Promise<Resultado> {
  const supabase = await createClient();

  const { error } = await supabase.from("staff").delete().eq("id", staffId);

  // 23503 = clave ajena. Le quedan citas, y borrarlas sería perder el historial.
  if (error?.code === "23503") {
    return {
      ok: false,
      mensaje:
        "Tiene citas registradas, así que no se puede borrar. Desmárcalo como activo: deja de recibir citas nuevas y su historial se conserva.",
    };
  }

  if (error) return { ok: false, mensaje: `No se pudo borrar: ${error.message}` };

  revalidatePath(`/dashboard/${clientId}/agenda`);
  return { ok: true, mensaje: "Trabajador borrado." };
}

// === Servicios ===

export async function guardarServicio(formData: FormData): Promise<Resultado> {
  const clientId = String(formData.get("client_id") ?? "");
  const servicioId = String(formData.get("servicio_id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const duracion = parseInt(String(formData.get("duracion_min") ?? ""), 10);
  const activo = formData.get("activo") === "si";
  const trabajadores = formData.getAll("trabajadores").map(String);

  if (!nombre) return { ok: false, mensaje: "Ponle un nombre al servicio." };
  if (!Number.isFinite(duracion) || duracion <= 0 || duracion > 600) {
    return { ok: false, mensaje: "La duración tiene que estar entre 1 y 600 minutos." };
  }

  // "mechitas, tinte , reflejos" -> ["mechitas", "tinte", "reflejos"]
  const alias = String(formData.get("alias") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const fila = { client_id: clientId, nombre, duracion_min: duracion, alias, activo };

  const { data: guardado, error } = servicioId
    ? await supabase
        .from("booking_services")
        .update(fila)
        .eq("id", servicioId)
        .select("id")
        .single()
    : await supabase.from("booking_services").insert(fila).select("id").single();

  if (error || !guardado) {
    return { ok: false, mensaje: `No se pudo guardar: ${error?.message}` };
  }

  // La matriz se reescribe entera: son cuatro filas y así no hay que calcular
  // qué casilla se ha marcado y cuál se ha desmarcado.
  const { error: errorBorrado } = await supabase
    .from("booking_service_staff")
    .delete()
    .eq("booking_service_id", guardado.id);

  if (errorBorrado) {
    return { ok: false, mensaje: `No se pudo guardar quién lo hace: ${errorBorrado.message}` };
  }

  if (trabajadores.length) {
    const { error: errorMatriz } = await supabase
      .from("booking_service_staff")
      .insert(
        trabajadores.map((staffId) => ({
          client_id: clientId,
          booking_service_id: guardado.id,
          staff_id: staffId,
        }))
      );

    if (errorMatriz) {
      return { ok: false, mensaje: `No se pudo guardar quién lo hace: ${errorMatriz.message}` };
    }
  }

  revalidatePath(`/dashboard/${clientId}/agenda`);

  if (!trabajadores.length) {
    return {
      ok: true,
      mensaje: `«${nombre}» guardado, pero no lo hace nadie todavía, así que no se puede reservar. Marca quién lo atiende.`,
    };
  }

  return { ok: true, mensaje: `«${nombre}» guardado.` };
}

export async function borrarServicio(
  clientId: string,
  servicioId: string
): Promise<Resultado> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("booking_services")
    .delete()
    .eq("id", servicioId);

  if (error) return { ok: false, mensaje: `No se pudo borrar: ${error.message}` };

  revalidatePath(`/dashboard/${clientId}/agenda`);
  return { ok: true, mensaje: "Servicio borrado. Las citas que ya lo tenían no cambian." };
}

// === Importar servicios desde un CSV ===

export type FilaPlan = {
  linea: number;
  nombre: string;
  duracionMin: number;
  alias: string[];
  accion: "crear" | "actualizar" | "error";
  detalle?: string;
  /** Solo en las de actualizar. */
  id?: string;
};

export type Plan = {
  filas: FilaPlan[];
  crear: number;
  actualizar: number;
  errores: number;
};

/**
 * Qué pasaría si se importara este fichero, sin escribir nada.
 *
 * Se calcula igual para la vista previa y para la importación de verdad, a
 * partir del mismo texto: lo que se enseña en la tabla es exactamente lo que se
 * va a hacer, no una estimación parecida.
 */
async function planificar(clientId: string, texto: string): Promise<Plan> {
  const supabase = await createClient();

  const { data: existentes } = await supabase
    .from("booking_services")
    .select("id, nombre")
    .eq("client_id", clientId);

  const porNombre = new Map(
    (existentes ?? []).map((s) => [normalizarNombre(s.nombre), s.id])
  );

  const filas: FilaPlan[] = parsearServicios(texto).map((f) => {
    if (f.error) {
      return { ...f, accion: "error" as const, detalle: f.error };
    }

    const id = porNombre.get(normalizarNombre(f.nombre));
    return id
      ? { ...f, accion: "actualizar" as const, id }
      : { ...f, accion: "crear" as const };
  });

  return {
    filas,
    crear: filas.filter((f) => f.accion === "crear").length,
    actualizar: filas.filter((f) => f.accion === "actualizar").length,
    errores: filas.filter((f) => f.accion === "error").length,
  };
}

export async function previsualizarImportacion(
  clientId: string,
  texto: string
): Promise<Plan> {
  return planificar(clientId, texto);
}

export async function importarServicios(
  clientId: string,
  texto: string
): Promise<Resultado> {
  const plan = await planificar(clientId, texto);

  if (!plan.crear && !plan.actualizar) {
    return { ok: false, mensaje: "No hay ninguna fila que importar." };
  }

  const supabase = await createClient();

  const nuevos = plan.filas.filter((f) => f.accion === "crear");
  if (nuevos.length) {
    const { error } = await supabase.from("booking_services").insert(
      nuevos.map((f) => ({
        client_id: clientId,
        nombre: f.nombre,
        duracion_min: f.duracionMin,
        alias: f.alias,
      }))
    );

    if (error) return { ok: false, mensaje: `No se pudo importar: ${error.message}` };
  }

  for (const f of plan.filas.filter((x) => x.accion === "actualizar")) {
    // Los alias solo se pisan si el fichero trae alguno. Una columna de alias
    // vacía suele ser que no se rellenó, no que se quieran borrar los que ya
    // estaban puestos a mano.
    const cambios: Record<string, unknown> = { duracion_min: f.duracionMin };
    if (f.alias.length) cambios.alias = f.alias;

    const { error } = await supabase
      .from("booking_services")
      .update(cambios)
      .eq("id", f.id!);

    if (error) {
      return { ok: false, mensaje: `Fallo al actualizar «${f.nombre}»: ${error.message}` };
    }
  }

  revalidatePath(`/dashboard/${clientId}/agenda`);

  const partes: string[] = [];
  if (plan.crear) partes.push(`${plan.crear} creados`);
  if (plan.actualizar) partes.push(`${plan.actualizar} actualizados`);
  if (plan.errores) partes.push(`${plan.errores} descartados por errores`);

  return {
    ok: true,
    mensaje: `${partes.join(", ")}. Ahora marca quién hace cada uno: los servicios nuevos no los hace nadie todavía.`,
  };
}

// === Matriz de quién hace qué ===

/**
 * Guarda la matriz entera de una vez.
 *
 * Se calcula la diferencia con lo que hay en vez de borrarlo todo y volver a
 * escribirlo: si el borrado saliera bien y el alta fallara, el cliente se
 * quedaría sin ninguna asignación y con todos sus servicios sin poder
 * reservarse. Con la diferencia, un fallo deja las cosas como estaban.
 */
export async function guardarMatriz(
  clientId: string,
  pares: { servicioId: string; staffId: string }[]
): Promise<Resultado> {
  const supabase = await createClient();

  const { data: actuales, error: errorLectura } = await supabase
    .from("booking_service_staff")
    .select("booking_service_id, staff_id")
    .eq("client_id", clientId);

  if (errorLectura) {
    return { ok: false, mensaje: `No se pudo leer la matriz: ${errorLectura.message}` };
  }

  const clave = (servicioId: string, staffId: string) => `${servicioId}|${staffId}`;
  const antes = new Set(
    (actuales ?? []).map((r) => clave(r.booking_service_id, r.staff_id))
  );
  const ahora = new Set(pares.map((p) => clave(p.servicioId, p.staffId)));

  const anadir = pares.filter((p) => !antes.has(clave(p.servicioId, p.staffId)));
  const quitar = (actuales ?? []).filter(
    (r) => !ahora.has(clave(r.booking_service_id, r.staff_id))
  );

  if (anadir.length) {
    const { error } = await supabase.from("booking_service_staff").insert(
      anadir.map((p) => ({
        client_id: clientId,
        booking_service_id: p.servicioId,
        staff_id: p.staffId,
      }))
    );

    if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  }

  // Agrupado por servicio para no lanzar una consulta por casilla desmarcada.
  const porServicio = new Map<string, string[]>();
  for (const r of quitar) {
    const lista = porServicio.get(r.booking_service_id) ?? [];
    lista.push(r.staff_id);
    porServicio.set(r.booking_service_id, lista);
  }

  for (const [servicioId, staffIds] of porServicio) {
    const { error } = await supabase
      .from("booking_service_staff")
      .delete()
      .eq("booking_service_id", servicioId)
      .in("staff_id", staffIds);

    if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath(`/dashboard/${clientId}/agenda`);

  if (!anadir.length && !quitar.length) {
    return { ok: true, mensaje: "No había nada que cambiar." };
  }

  return {
    ok: true,
    mensaje: `Matriz guardada: ${anadir.length} asignaciones nuevas y ${quitar.length} retiradas.`,
  };
}

// === Citas ===

/**
 * Cancelar una cita desde el panel de la agencia.
 *
 * Con el cliente normal de Supabase: un `agency_admin` ya tiene UPDATE sobre
 * las citas de sus clientes por la RLS de la 0014, así que la política es la
 * frontera. La versión del cliente final vive en `panel/citas/acciones.ts` y sí
 * necesita `service_role`, porque su RLS es de solo lectura.
 *
 * No se borra la fila, se marca como cancelada: la restricción anti-solape solo
 * mira las confirmadas, así que el hueco queda libre al momento y el historial
 * se conserva.
 */
export async function cancelarCitaAgencia(
  clientId: string,
  citaId: string
): Promise<{ ok: boolean; mensaje?: string }> {
  const supabase = await createClient();

  const { data: cita } = await supabase
    .from("appointments")
    .select("id, client_id, estado")
    .eq("id", citaId)
    .maybeSingle();

  if (!cita || cita.client_id !== clientId) {
    return { ok: false, mensaje: "Esa cita no es de este cliente." };
  }

  if (cita.estado !== "confirmada") {
    return { ok: false, mensaje: "Esa cita ya estaba cancelada. Recarga la página." };
  }

  const { error } = await supabase.rpc("agenda_cancelar", { p_id: citaId });

  if (error) {
    return { ok: false, mensaje: `No se ha podido cancelar: ${error.message}` };
  }

  revalidatePath(`/dashboard/${clientId}/agenda`);

  return { ok: true };
}
