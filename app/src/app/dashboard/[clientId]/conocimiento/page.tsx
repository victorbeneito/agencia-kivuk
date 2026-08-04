import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Documento, NuevoDocumento, type DocumentoData } from "./documento";
import { CATEGORIAS } from "./categorias";

export default async function ConocimientoPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, category, content, source_url, knowledge_chunks(id)")
    .eq("client_id", clientId)
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  // Antes de aplicar la migración 0006 la tabla no existe: se avisa en vez de
  // reventar la página entera.
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se pudo leer la base de conocimiento</CardTitle>
          <CardDescription>
            {error.message}. Si aún no has ejecutado{" "}
            <code>supabase/migrations/0006_rag.sql</code> en el SQL Editor de
            Supabase, es eso.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const documentos: DocumentoData[] = (
    (data ?? []) as unknown as (Omit<DocumentoData, "trozos"> & {
      knowledge_chunks: { id: string }[] | null;
    })[]
  ).map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    content: d.content,
    source_url: d.source_url,
    trozos: d.knowledge_chunks?.length ?? 0,
  }));

  const sinIndexar = documentos.filter((d) => d.trozos === 0).length;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Base de conocimiento</CardTitle>
          <CardDescription>
            Lo que el bot sabe del negocio. En cada mensaje busca aquí los
            fragmentos que hablan de lo que le acaban de preguntar, y responde
            solo con eso. Los precios de producto no van aquí: salen del
            catálogo sincronizado.
          </CardDescription>
        </CardHeader>
        {documentos.length > 0 && (
          <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              {documentos.length}{" "}
              {documentos.length === 1 ? "documento" : "documentos"}
            </span>
            {sinIndexar > 0 && (
              <span className="text-destructive">
                {sinIndexar} sin indexar — vuelve a guardarlos
              </span>
            )}
          </CardContent>
        )}
      </Card>

      <NuevoDocumento clientId={clientId} />

      {documentos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Todavía no hay conocimiento cargado
            </CardTitle>
            <CardDescription>
              Sin documentos el bot responde solo con su personalidad y no puede
              dar ni un dato concreto del negocio. Empieza por lo que más
              preguntan: envíos, devoluciones, horario y contacto.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        CATEGORIAS.filter((c) =>
          documentos.some((d) => d.category === c.valor)
        ).map((c) => (
          <section key={c.valor} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {c.etiqueta}
            </h2>
            <div className="grid gap-3">
              {documentos
                .filter((d) => d.category === c.valor)
                .map((d) => (
                  <Documento key={d.id} clientId={clientId} doc={d} />
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
