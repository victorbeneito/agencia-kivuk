import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clienteDelPanel, modulosActivos } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PiezaCliente } from "./pieza-cliente";

/**
 * Contenido, visto por el cliente.
 *
 * Se abre en «Por revisar» cuando hay algo esperando, porque es a lo que se
 * viene. Lo descartado existe pero no se enseña de entrada: interesa una vez al
 * mes, no cada día.
 */
const FILTROS = [
  { clave: "pendientes", etiqueta: "Por revisar", estados: ["pending", "failed", "draft"] },
  { clave: "aprobadas", etiqueta: "Aprobadas", estados: ["approved", "scheduled", "publishing"] },
  { clave: "publicadas", etiqueta: "Publicadas", estados: ["published"] },
  { clave: "descartadas", etiqueta: "Descartadas", estados: ["rejected"] },
];

type Fila = {
  id: string;
  status: string;
  caption: string | null;
  media_urls: string[] | null;
  meta: { titular?: string } | null;
};

export default async function PanelContenidoPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const perfil = await clienteDelPanel();
  const modulos = await modulosActivos(perfil.clientId);
  if (!modulos.has("social")) notFound();

  const { estado } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("content_items")
    .select("id, status, caption, media_urls, meta")
    .eq("client_id", perfil.clientId)
    .order("created_at", { ascending: false });

  const todas = ((data ?? []) as Fila[]).map((f) => ({
    id: f.id,
    status: f.status,
    caption: f.caption ?? "",
    mediaUrl: f.media_urls?.[0] ?? "",
    titular: f.meta?.titular ?? "",
  }));

  const cuantas = (estados: string[]) =>
    todas.filter((p) => estados.includes(p.status)).length;

  const filtroActivo =
    FILTROS.find((f) => f.clave === estado) ??
    (cuantas(FILTROS[0].estados) > 0 ? FILTROS[0] : FILTROS[2]);

  const piezas = todas.filter((p) => filtroActivo.estados.includes(p.status));

  if (todas.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay contenido</CardTitle>
            <CardDescription>
              Cuando preparemos publicaciones para tus redes, aparecerán aquí
              para que las veas antes de que se publique nada.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => {
          const n = cuantas(f.estados);
          const activo = f.clave === filtroActivo.clave;

          return (
            <Link
              key={f.clave}
              href={`/panel/contenido?estado=${f.clave}`}
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
        No se publica nada sin tu visto bueno. Si quieres cambiar el texto,
        puedes hacerlo aquí mismo antes de aprobarlo.
      </p>

      {piezas.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {piezas.map((pieza) => (
            <PiezaCliente key={pieza.id} pieza={pieza} />
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
