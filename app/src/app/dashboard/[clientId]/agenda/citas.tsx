import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CitasLista } from "@/components/citas-lista";
import type { DiaDeCitas } from "@/lib/citas";
import { cancelarCitaAgencia } from "./acciones";

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
  dias,
}: {
  clientId: string;
  dias: DiaDeCitas[];
}) {
  const total = dias.reduce((n, d) => n + d.citas.length, 0);

  async function cancelar(citaId: string) {
    "use server";
    return cancelarCitaAgencia(clientId, citaId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citas</CardTitle>
        <CardDescription>
          {total
            ? `${total} ${total === 1 ? "cita" : "citas"} en los próximos 30 días. Las canceladas no salen: su hueco vuelve a estar libre.`
            : "Las que reserve el bot por WhatsApp aparecen aquí solas."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CitasLista
          dias={dias}
          cancelar={cancelar}
          vacio="Todavía no hay ninguna cita. Cuando el bot reserve una, la verás aquí y el cliente en su panel."
        />
      </CardContent>
    </Card>
  );
}
