import Link from "next/link";
import { AlertTriangle, BadgeEuro, Clock, FileText, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { EstadoFacturaBadge } from "@/components/estado-factura";
import { euros, fecha, num, estaVencida, type EstadoFactura } from "@/lib/facturacion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarraAcciones } from "./barra-acciones";

/**
 * Todo el dinero de la agencia en una pantalla.
 *
 * Las cuatro cifras de arriba responden a lo que se pregunta un lunes por la
 * mañana: qué he cobrado este año, qué me deben, qué se ha pasado de fecha y qué
 * tengo a medias. El resto es la lista, ordenada por lo más reciente.
 */
export default async function FacturacionPage() {
  const perfil = await requireAgencia();
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("owner_user_id", perfil.userId)
    .single();

  const [{ data: facturas }, { data: clientes }, { data: ajustes }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, numero, estado, fecha_emision, fecha_vencimiento, total, concepto, client_id, clients(name)"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("clients").select("id, name").order("name"),
      supabase
        .from("agency_billing_settings")
        .select("razon_social, nif")
        .eq("agency_id", agency?.id ?? "")
        .maybeSingle(),
    ]);

  const lista = (facturas ?? []).map((f) => ({
    ...f,
    total: num(f.total),
    estado: f.estado as EstadoFactura,
    cliente:
      (f.clients as unknown as { name: string } | null)?.name ?? "Cliente",
  }));

  const anio = new Date().getFullYear().toString();

  const cobrado = lista
    .filter((f) => f.estado === "pagada" && f.fecha_emision.startsWith(anio))
    .reduce((t, f) => t + f.total, 0);

  const porCobrar = lista
    .filter((f) => f.estado === "emitida" || f.estado === "enviada")
    .reduce((t, f) => t + f.total, 0);

  const vencidas = lista.filter((f) =>
    estaVencida({ estado: f.estado, fecha_vencimiento: f.fecha_vencimiento })
  );

  const borradores = lista.filter((f) => f.estado === "borrador").length;

  const faltanDatos = !ajustes?.nif || !ajustes?.razon_social;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Facturación</h1>
          <p className="text-sm text-muted-foreground">
            Lo que cobras a tus clientes, de dónde sale y qué falta por cobrar.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard/facturacion/servicios" />}
        >
          Servicios y tarifas
        </Button>
      </div>

      {faltanDatos && (
        <Card className="border-[var(--kivuk-terracota)]/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-[var(--kivuk-terracota)]" />
              Faltan tus datos fiscales
            </CardTitle>
            <CardDescription>
              Sin razón social y NIF no se puede emitir ninguna factura: son
              obligatorios en el documento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/configuracion" />}
            >
              Completarlos
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BadgeEuro}
          rotulo={`Cobrado en ${anio}`}
          valor={euros(cobrado)}
          tono="verde"
        />
        <StatCard
          icon={Wallet}
          rotulo="Por cobrar"
          valor={euros(porCobrar)}
          pie="Emitidas y enviadas"
          tono="azul"
        />
        <StatCard
          icon={Clock}
          rotulo="Vencidas"
          valor={euros(vencidas.reduce((t, f) => t + f.total, 0))}
          pie={vencidas.length ? `${vencidas.length} sin cobrar a tiempo` : undefined}
          tono="terracota"
        />
        <StatCard
          icon={FileText}
          rotulo="Borradores"
          valor={borradores}
          pie={borradores ? "Pendientes de emitir" : undefined}
          tono="arena"
        />
      </div>

      <BarraAcciones clientes={clientes ?? []} />

      {lista.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/facturacion/${f.id}`}
                        className="hover:underline"
                      >
                        {f.numero ?? "Borrador"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/${f.client_id}/facturacion`}
                        className="hover:underline"
                      >
                        {f.cliente}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {f.concepto || "—"}
                    </TableCell>
                    <TableCell>{fecha(f.fecha_emision)}</TableCell>
                    <TableCell>{fecha(f.fecha_vencimiento)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {euros(f.total)}
                    </TableCell>
                    <TableCell>
                      <EstadoFacturaBadge
                        estado={f.estado}
                        fechaVencimiento={f.fecha_vencimiento}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no has facturado nada</CardTitle>
            <CardDescription>
              Define tus servicios y tarifas, asígnaselos a cada cliente en su
              pestaña de Facturación y genera la primera del periodo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
