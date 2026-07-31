import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewClientForm } from "./new-client-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ModuleName } from "./[clientId]/actions";

const MODULE_LABELS: Record<ModuleName, string> = {
  whatsapp: "WhatsApp",
  voice: "Voz",
  calendar: "Agenda",
  email: "Correos",
  social: "Redes",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Las tres consultas van juntas: pintar una tarjeta por cliente necesita
  // saber qué módulos tiene y si le espera algo por revisar.
  const [{ data: clients, error }, { data: modules }, { data: piezas }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("client_modules").select("client_id, module, active"),
      supabase.from("content_items").select("client_id").eq("status", "pending"),
    ]);

  const modulosPorCliente = new Map<string, ModuleName[]>();
  for (const m of modules ?? []) {
    if (!m.active) continue;
    const lista = modulosPorCliente.get(m.client_id) ?? [];
    lista.push(m.module as ModuleName);
    modulosPorCliente.set(m.client_id, lista);
  }

  const pendientesPorCliente = new Map<string, number>();
  for (const p of piezas ?? []) {
    pendientesPorCliente.set(
      p.client_id,
      (pendientesPorCliente.get(p.client_id) ?? 0) + 1
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cada cliente con sus módulos activos y lo que tiene pendiente.
          </p>
        </div>
        <NewClientForm />
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <pre className="text-sm text-destructive">
              {JSON.stringify(error, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : clients && clients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const activos = modulosPorCliente.get(client.id) ?? [];
            const pendientes = pendientesPorCliente.get(client.id) ?? 0;

            return (
              <Link key={client.id} href={`/dashboard/${client.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{client.name}</CardTitle>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                    <CardDescription>
                      Alta el{" "}
                      {new Date(client.created_at).toLocaleDateString("es-ES")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {activos.length ? (
                        activos.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-[#8EB9C5]/25 px-2.5 py-0.5 text-xs font-medium text-[#3b7686]"
                          >
                            {MODULE_LABELS[m]}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sin módulos activos
                        </span>
                      )}
                    </div>

                    {pendientes > 0 && (
                      <span className="w-fit rounded-full bg-[#B45831]/15 px-2.5 py-0.5 text-xs font-medium text-[#B45831]">
                        {pendientes}{" "}
                        {pendientes === 1 ? "pieza" : "piezas"} por revisar
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay clientes</CardTitle>
            <CardDescription>
              Da de alta el primero y activa los módulos que haya contratado.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
