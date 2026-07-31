import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

/**
 * Filtros de la vista. `todas` no es un estado, es la ausencia de filtro; se
 * modela igual que el resto para que el enlace activo salga solo.
 */
const FILTROS: {
  clave: string;
  etiqueta: string;
  /** Vacío = sin filtrar. */
  estados: EstadoPieza[];
}[] = [
  { clave: "pendientes", etiqueta: "Por revisar", estados: ["pending", "failed"] },
  { clave: "aprobadas", etiqueta: "Aprobadas", estados: ["approved", "scheduled"] },
  { clave: "publicadas", etiqueta: "Publicadas", estados: ["published"] },
  { clave: "descartadas", etiqueta: "Descartadas", estados: ["rejected"] },
  { clave: "todas", etiqueta: "Todas", estados: [] },
];

type Fila = {
  id: string;
  status: EstadoPieza;
  format: string;
  caption: string | null;
  media_urls: string[] | null;
  meta: {
    titular?: string;
    producto?: string;
    avisos?: string[];
    estilo?: string;
  } | null;
};

export default async function ContenidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { clientId } = await params;
  const { estado } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("content_items")
    .select("id, status, format, caption, media_urls, meta")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const todas: PiezaData[] = ((data ?? []) as Fila[])
    .map((f) => ({
      id: f.id,
      status: f.status,
      format: f.format,
      caption: f.caption ?? "",
      mediaUrl: f.media_urls?.[0] ?? "",
      titular: f.meta?.titular ?? "",
      producto: f.meta?.producto ?? "",
      avisos: f.meta?.avisos ?? [],
      estilo: f.meta?.estilo ?? "",
    }))
    .sort((a, b) => (PRIORIDAD[a.status] ?? 9) - (PRIORIDAD[b.status] ?? 9));

  const cuantas = (estados: readonly string[]) =>
    estados.length
      ? todas.filter((p) => estados.includes(p.status)).length
      : todas.length;

  const filtroActivo =
    FILTROS.find((f) => f.clave === estado) ??
    // Por defecto se abre en lo que espera decisión, que es a lo que se viene.
    (cuantas(["pending", "failed"]) > 0 ? FILTROS[0] : FILTROS[4]);

  const piezas = filtroActivo.estados.length
    ? todas.filter((p) => filtroActivo.estados.includes(p.status))
    : todas;

  if (!todas.length) {
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => {
          const n = cuantas(f.estados);
          const activo = f.clave === filtroActivo.clave;

          return (
            <Link
              key={f.clave}
              href={`/dashboard/${clientId}/contenido?estado=${f.clave}`}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                activo
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f.etiqueta}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  activo ? "bg-white/20" : "bg-muted"
                )}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Solo se publica lo que apruebes. Puedes editar el texto antes.
      </p>

      {piezas.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {piezas.map((pieza) => (
            <Pieza key={pieza.id} clientId={clientId} pieza={pieza} />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nada en «{filtroActivo.etiqueta.toLowerCase()}»
            </CardTitle>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
