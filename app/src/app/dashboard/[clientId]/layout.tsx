import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClientTabs } from "./client-tabs";

/**
 * Cabecera y navegación comunes a todo lo de un cliente.
 *
 * La separación entre las pestañas no es estética: la configuración se toca una
 * vez y se olvida, mientras que contenido y conversaciones se miran a diario.
 * Tenerlo todo en una sola página obligaba a bajar entre credenciales para
 * llegar a lo que de verdad se consulta.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a clientes
        </Link>
        <h1 className="text-2xl font-semibold">{client?.name ?? "Cliente"}</h1>
        <ClientTabs clientId={clientId} />
      </div>

      {children}
    </div>
  );
}
