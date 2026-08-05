import Link from "next/link";
import { CheckCircle2, Clock, MessageSquare, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { modulosActivos, requireCliente } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Inicio del panel del cliente.
 *
 * Responde a una sola pregunta: ¿hay algo que requiera mi atención ahora mismo?
 * Primero lo que espera respuesta o decisión, y solo después los números. Un
 * cliente que entra y no ve nada urgente debería poder cerrar la pestaña en
 * cinco segundos.
 */
export default async function PanelInicioPage() {
  const perfil = await requireCliente();
  const supabase = await createClient();
  const modulos = await modulosActivos(perfil.clientId);

  const [{ data: conversaciones }, { data: piezas }] = await Promise.all([
    modulos.has("whatsapp")
      ? supabase
          .from("conversations")
          .select("id, unread_count, handoff_requested_at, mode")
          .eq("client_id", perfil.clientId)
      : Promise.resolve({
          data: [] as {
            id: string;
            unread_count: number;
            handoff_requested_at: string | null;
            mode: string;
          }[],
        }),
    modulos.has("social")
      ? supabase
          .from("content_items")
          .select("status")
          .eq("client_id", perfil.clientId)
      : Promise.resolve({ data: [] as { status: string }[] }),
  ]);

  const sinLeer = (conversaciones ?? []).reduce(
    (t, c) => t + (c.unread_count ?? 0),
    0
  );
  const esperandoPersona = (conversaciones ?? []).filter(
    (c) => c.handoff_requested_at && c.mode !== "human"
  ).length;

  const porEstado = (estado: string) =>
    (piezas ?? []).filter((p) => p.status === estado).length;
  const porRevisar = porEstado("pending");

  const sinModulos = !modulos.has("whatsapp") && !modulos.has("social");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {esperandoPersona > 0 && (
        <Card className="border-[var(--kivuk-terracota)]/40">
          <CardHeader>
            <CardTitle>
              {esperandoPersona === 1
                ? "Una persona ha pedido hablar contigo"
                : `${esperandoPersona} personas han pedido hablar contigo`}
            </CardTitle>
            <CardDescription>
              El asistente ha hecho lo que ha podido y toca que entres tú.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href="/panel/conversaciones" />}
            >
              Ir a las conversaciones
            </Button>
          </CardContent>
        </Card>
      )}

      {porRevisar > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {porRevisar} {porRevisar === 1 ? "pieza" : "piezas"} esperando tu
              visto bueno
            </CardTitle>
            <CardDescription>
              No se publica nada hasta que lo apruebes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/panel/contenido" />}>
              Revisar contenido
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modulos.has("whatsapp") && (
          <>
            <StatCard
              icon={MessageSquare}
              rotulo="Conversaciones"
              valor={(conversaciones ?? []).length}
              tono="azul"
              href="/panel/conversaciones"
            />
            <StatCard
              icon={Clock}
              rotulo="Sin leer"
              valor={sinLeer}
              pie={sinLeer ? "Mensajes nuevos" : undefined}
              tono="terracota"
              href="/panel/conversaciones"
            />
          </>
        )}
        {modulos.has("social") && (
          <>
            <StatCard
              icon={CheckCircle2}
              rotulo="Por revisar"
              valor={porRevisar}
              tono="arena"
              href="/panel/contenido"
            />
            <StatCard
              icon={Send}
              rotulo="Publicadas"
              valor={porEstado("published")}
              tono="verde"
              href="/panel/contenido"
            />
          </>
        )}
      </div>

      {sinModulos && (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay nada activo</CardTitle>
            <CardDescription>
              En cuanto pongamos en marcha tus servicios, aparecerán aquí. Si
              esperabas ver algo, avísanos.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
