import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { Bandeja } from "@/components/bandeja/bandeja";
import {
  COLUMNAS_CONVERSACION,
  desdeFila,
  type FilaConversacion,
} from "@/components/bandeja/tipos";

/**
 * La agencia ve exactamente la misma bandeja que el cliente, con las mismas
 * capacidades: puede tomar el mando de un chat y responder. Es el mismo
 * componente — si aquí se viera algo distinto, sería una segunda interfaz que
 * mantener.
 */
export default async function ClientConversacionesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAgencia();
  const { clientId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("conversations")
    .select(COLUMNAS_CONVERSACION)
    .eq("client_id", clientId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .returns<FilaConversacion[]>();

  return (
    // Aquí la cabecera del cliente (nombre y pestañas) ocupa más que en el
    // panel del cliente, así que se le da una altura holgada en vez de restar
    // píxeles exactos: el scroll sigue siendo interno.
    <div className="flex h-[70vh] min-h-96 flex-col overflow-hidden rounded-xl border bg-card">
      <Bandeja
        clientId={clientId}
        conversacionesIniciales={(data ?? []).map(desdeFila)}
      />
    </div>
  );
}
