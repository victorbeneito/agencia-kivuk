import { CalendarClock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAgencia } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hhmm } from "@/lib/agenda";
import { Trabajadores, type Trabajador } from "./trabajadores";
import {
  ServiciosAgenda,
  type ServicioAgenda,
  type TrabajadorBreve,
} from "./servicios";
import { ImportarServicios } from "./importar-servicios";
import { MatrizServicios } from "./matriz";
import { CitasDelCliente } from "./citas";
import { citasProximas } from "@/lib/citas";

type FilaHorario = { dia_semana: number; hora_inicio: string; hora_fin: string };

/**
 * Quién atiende y qué se reserva.
 *
 * Las dos listas se editan por separado pero se leen juntas: la matriz de "quién
 * hace qué" vive dentro de cada servicio, y para dibujarla hacen falta los
 * trabajadores. De ahí que sea una sola pantalla y no dos.
 */
export default async function AgendaPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAgencia();
  const { clientId } = await params;
  const supabase = await createClient();

  const [cliente, modulo, staff, servicios] = await Promise.all([
    supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    supabase
      .from("client_modules")
      .select("active")
      .eq("client_id", clientId)
      .eq("module", "calendar")
      .maybeSingle(),
    supabase
      .from("staff")
      .select(
        "id, nombre, calendar_id, activo, staff_hours(dia_semana, hora_inicio, hora_fin)"
      )
      .eq("client_id", clientId)
      .order("orden")
      .order("created_at"),
    supabase
      .from("booking_services")
      .select(
        "id, nombre, duracion_min, alias, activo, booking_service_staff(staff_id)"
      )
      .eq("client_id", clientId)
      .order("orden")
      .order("created_at"),
  ]);

  const trabajadores: Trabajador[] = (staff.data ?? []).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    calendarId: t.calendar_id ?? "",
    activo: t.activo,
    horario: ((t.staff_hours ?? []) as FilaHorario[]).map((h) => ({
      dia: h.dia_semana,
      inicio: hhmm(h.hora_inicio),
      fin: hhmm(h.hora_fin),
    })),
  }));

  const trabajadoresBreves: TrabajadorBreve[] = trabajadores.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    activo: t.activo,
  }));

  // Después de las otras consultas y no dentro del Promise.all de arriba: es la
  // única que depende de la hora actual, y tenerla aparte deja claro que lo de
  // arriba es configuración y esto es el día a día.
  const dias = await citasProximas(supabase, clientId);

  const serviciosAgenda: ServicioAgenda[] = (servicios.data ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    duracionMin: s.duracion_min,
    alias: s.alias ?? [],
    activo: s.activo,
    trabajadores: ((s.booking_service_staff ?? []) as { staff_id: string }[]).map(
      (m) => m.staff_id
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      {!modulo.data?.active && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <p>
            El módulo de agenda está desactivado para este cliente, así que el
            bot no dará citas por mucho que configures aquí. Se activa en{" "}
            <strong>Configuración</strong>.
          </p>
        </div>
      )}

      {/* Un cliente dado de alta después de la migración 0014 no tiene ningún
          trabajador, y sin trabajadores el motor no encuentra a nadie a quien
          asignarle la cita: el bot contesta que no puede atender. Es un fallo
          silencioso —todo lo demás está bien configurado— así que se avisa en
          rojo y no como una frase gris de lista vacía. */}
      {modulo.data?.active && trabajadores.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            Este cliente tiene la agenda activada pero <strong>no hay ningún
            trabajador</strong>, así que el bot no puede dar ninguna cita. Añade
            al menos uno: si atiende una sola persona, con un trabajador basta y
            el bot no lo nombrará nunca.
          </p>
        </div>
      )}

      {modulo.data?.active && trabajadores.length > 0 && (
        <CitasDelCliente clientId={clientId} dias={dias} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trabajadores</CardTitle>
          <CardDescription>
            Quién atiende. Cada uno tiene su propio horario, y el bot solo ofrece
            huecos de quien esté libre de verdad. Si en el negocio atiende una
            sola persona, con un trabajador basta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Trabajadores clientId={clientId} trabajadores={trabajadores} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servicios</CardTitle>
          <CardDescription>
            Qué se puede reservar, cuánto dura cada cosa y quién la hace. Es lo
            que permite que unas mechas ocupen dos horas y solo las cojan quienes
            saben hacerlas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ServiciosAgenda
            clientId={clientId}
            servicios={serviciosAgenda}
            trabajadores={trabajadoresBreves}
          />
          <ImportarServicios
            clientId={clientId}
            servicios={serviciosAgenda}
            nombreCliente={cliente.data?.name ?? "cliente"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quién hace qué</CardTitle>
          <CardDescription>
            El reparto completo de un vistazo. Una fila asigna un servicio a
            todos, y una columna le da a alguien todos los servicios. En rojo, lo
            que no puede hacer nadie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MatrizServicios
            clientId={clientId}
            servicios={serviciosAgenda}
            trabajadores={trabajadoresBreves}
          />
        </CardContent>
      </Card>
    </div>
  );
}
