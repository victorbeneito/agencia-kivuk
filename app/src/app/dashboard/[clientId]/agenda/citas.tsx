import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarioCitas, SelectorDeVista, type Vista } from "@/components/calendario-citas";
import { CitasLista } from "@/components/citas-lista";
import type {
  Ausencia,
  Cita,
  DiaDeCitas,
  NuevaCita,
  NuevoBloqueo,
  ServicioReservable,
  TrabajadorDeCalendario,
} from "@/lib/citas";
import {
  borrarBloqueoAgencia,
  cancelarCitaAgencia,
  crearBloqueoAgencia,
  crearCitaAgencia,
} from "./acciones";

/**
 * Las citas del cliente, vistas desde la agencia.
 *
 * Va la primera de la pestaña y por delante de la configuración a propósito:
 * trabajadores y servicios se tocan el día del alta y casi nunca más, mientras
 * que esto es lo que se mira para comprobar que el bot está dando citas de
 * verdad. Es además la pantalla que se enseña en una demo justo después de
 * reservar por WhatsApp.
 */
export function CitasDelCliente({
  clientId,
  vista,
  fecha,
  dias,
  citas,
  ausencias,
  trabajadores,
  servicios,
}: {
  clientId: string;
  vista: Vista | "lista";
  fecha: string;
  /** Para la lista. */
  dias: DiaDeCitas[];
  /** Para el calendario. */
  citas: Cita[];
  ausencias: Ausencia[];
  trabajadores: TrabajadorDeCalendario[];
  servicios: ServicioReservable[];
}) {
  const base = `/dashboard/${clientId}/agenda`;
  const totalLista = dias.reduce((n, d) => n + d.citas.length, 0);

  async function cancelar(citaId: string) {
    "use server";
    return cancelarCitaAgencia(clientId, citaId);
  }

  async function crear(datos: NuevaCita) {
    "use server";
    return crearCitaAgencia(clientId, datos);
  }

  async function bloquear(datos: NuevoBloqueo) {
    "use server";
    return crearBloqueoAgencia(clientId, datos);
  }

  async function quitarBloqueo(id: string) {
    "use server";
    return borrarBloqueoAgencia(clientId, id);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Citas</CardTitle>
          <CardDescription>
            {vista === "lista"
              ? totalLista
                ? `${totalLista} ${totalLista === 1 ? "cita" : "citas"} en los próximos 30 días. Las canceladas no salen: su hueco vuelve a estar libre.`
                : "Las que reserve el bot por WhatsApp aparecen aquí solas."
              : "La rejilla enseña lo que una lista no puede: el hueco entre las citas."}
          </CardDescription>
        </div>
        <SelectorDeVista base={base} vista={vista} fecha={fecha} />
      </CardHeader>
      <CardContent>
        {vista === "lista" ? (
          <CitasLista
            dias={dias}
            cancelar={cancelar}
            vacio="Todavía no hay ninguna cita. Cuando el bot reserve una, la verás aquí y el cliente en su panel."
          />
        ) : (
          <CalendarioCitas
            vista={vista}
            fecha={fecha}
            citas={citas}
            ausencias={ausencias}
            trabajadores={trabajadores}
            servicios={servicios}
            base={base}
            crear={crear}
            bloquear={bloquear}
            quitarBloqueo={quitarBloqueo}
          />
        )}
      </CardContent>
    </Card>
  );
}
