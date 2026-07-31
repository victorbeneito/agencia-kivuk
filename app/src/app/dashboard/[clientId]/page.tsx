import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ModuleName } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MODULE_LABELS: Record<ModuleName, string> = {
  whatsapp: "WhatsApp",
  voice: "Agente de voz",
  calendar: "Agenda / Calendar",
  email: "Automatización de correos",
  social: "Redes sociales",
};

const MODULE_ORDER: ModuleName[] = [
  "whatsapp",
  "voice",
  "calendar",
  "email",
  "social",
];

export default async function ClientSummaryPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [{ data: modules }, { count: conversaciones }, { data: piezas }] =
    await Promise.all([
      supabase
        .from("client_modules")
        .select("module, active")
        .eq("client_id", clientId),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("content_items")
        .select("status")
        .eq("client_id", clientId),
    ]);

  const activos = new Set(
    (modules ?? []).filter((m) => m.active).map((m) => m.module as ModuleName)
  );

  const porEstado = (estado: string) =>
    (piezas ?? []).filter((p) => p.status === estado).length;

  const pendientes = porEstado("pending");

  return (
    <div className="flex flex-col gap-4">
      {pendientes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {pendientes} {pendientes === 1 ? "pieza" : "piezas"} esperando tu
              visto bueno
            </CardTitle>
            <CardDescription>
              Nada se publica hasta que las apruebes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/${clientId}/contenido`} />}
            >
              Revisar contenido
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Conversaciones</CardDescription>
            <CardTitle className="text-3xl">{conversaciones ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Piezas publicadas</CardDescription>
            <CardTitle className="text-3xl">{porEstado("published")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Aprobadas sin publicar</CardDescription>
            <CardTitle className="text-3xl">{porEstado("approved")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
          <CardDescription>
            Se activan y configuran en la pestaña de Configuración.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {MODULE_ORDER.map((module) => (
            <div
              key={module}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="text-sm font-medium">
                {MODULE_LABELS[module]}
              </span>
              <span
                className={
                  activos.has(module)
                    ? "text-sm text-foreground"
                    : "text-sm text-muted-foreground"
                }
              >
                {activos.has(module) ? "Activo" : "Inactivo"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
