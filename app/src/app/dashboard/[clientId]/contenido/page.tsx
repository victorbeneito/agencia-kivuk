import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pieza, type PiezaData } from "./pieza";
import type { EstadoPieza } from "./actions";

/** Orden de revisión: primero lo que espera decisión, al final lo ya resuelto. */
const PRIORIDAD: Record<string, number> = {
  pending: 0,
  failed: 1,
  approved: 2,
  scheduled: 3,
  published: 4,
  rejected: 5,
};

type Fila = {
  id: string;
  status: EstadoPieza;
  format: string;
  caption: string | null;
  media_urls: string[] | null;
  meta: { titular?: string; producto?: string; avisos?: string[] } | null;
};

export default async function ContenidoPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("content_items")
    .select("id, status, format, caption, media_urls, meta")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const piezas: PiezaData[] = ((data ?? []) as Fila[])
    .map((f) => ({
      id: f.id,
      status: f.status,
      format: f.format,
      caption: f.caption ?? "",
      mediaUrl: f.media_urls?.[0] ?? "",
      titular: f.meta?.titular ?? "",
      producto: f.meta?.producto ?? "",
      avisos: f.meta?.avisos ?? [],
    }))
    .sort((a, b) => (PRIORIDAD[a.status] ?? 9) - (PRIORIDAD[b.status] ?? 9));

  const pendientes = piezas.filter((p) => p.status === "pending").length;

  if (!piezas.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todavía no hay contenido</CardTitle>
          <CardDescription>
            Las piezas se generan desde n8n a partir del catálogo del cliente.
            Cuando haya un lote, aparecerá aquí para que lo revises antes de que
            se publique nada.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">
          {pendientes > 0
            ? `${pendientes} ${pendientes === 1 ? "pieza" : "piezas"} por revisar`
            : "Todo revisado"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Solo se publica lo que apruebes. Puedes editar el texto antes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {piezas.map((pieza) => (
          <Pieza key={pieza.id} clientId={clientId} pieza={pieza} />
        ))}
      </div>
    </div>
  );
}
