import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { EstadoFacturaBadge } from "@/components/estado-factura";
import { euros, fecha, num, type EstadoFactura, type Recurrencia } from "@/lib/facturacion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FichaFiscal, type PerfilFiscal } from "./ficha-fiscal";
import { ServiciosContratados, type Contratado } from "./contratados";
import { NuevaFactura } from "./nueva-factura";

/**
 * La pestaña de dinero de un cliente: con qué datos se le factura, qué paga y
 * qué se le ha facturado ya.
 */
export default async function FacturacionClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const perfilUsuario = await requireAgencia();
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_user_id", perfilUsuario.userId)
    .single();

  const [
    { data: cliente },
    { data: fiscal },
    { data: contratadosRaw },
    { data: catalogoRaw },
    { data: facturas },
  ] = await Promise.all([
    supabase.from("clients").select("name").eq("id", clientId).single(),
    supabase
      .from("client_billing_profiles")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at"),
    supabase
      .from("services")
      .select("id, nombre, precio, recurrencia")
      .eq("agency_id", agency?.id ?? "")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("invoices")
      .select("id, numero, estado, fecha_emision, fecha_vencimiento, total, concepto")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const contratados: Contratado[] = (contratadosRaw ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    precio: num(c.precio),
    cantidad: num(c.cantidad),
    recurrencia: c.recurrencia as Recurrencia,
    estado: c.estado,
    fecha_alta: c.fecha_alta,
    proxima_factura: c.proxima_factura,
  }));

  const catalogo = (catalogoRaw ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    precio: num(s.precio),
    recurrencia: s.recurrencia as string,
  }));

  // Lo que factura este cliente al mes, contando solo lo activo y recurrente:
  // es el número que dice cuánto vale la cuenta.
  const mensual = contratados
    .filter((c) => c.estado === "activo")
    .reduce((total, c) => {
      const meses =
        c.recurrencia === "mensual"
          ? 1
          : c.recurrencia === "trimestral"
            ? 3
            : c.recurrencia === "anual"
              ? 12
              : 0;
      return meses ? total + (c.precio * c.cantidad) / meses : total;
    }, 0);

  const pendienteDeCobro = (facturas ?? [])
    .filter((f) => f.estado === "emitida" || f.estado === "enviada")
    .reduce((t, f) => t + num(f.total), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <span>
            <span className="text-muted-foreground">Facturación recurrente: </span>
            <strong>{euros(mensual)}</strong>
            <span className="text-muted-foreground"> / mes</span>
          </span>
          <span>
            <span className="text-muted-foreground">Pendiente de cobro: </span>
            <strong>{euros(pendienteDeCobro)}</strong>
          </span>
        </div>
        <NuevaFactura clientId={clientId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Servicios contratados</CardTitle>
          <CardDescription>
            De aquí salen las facturas del periodo. Pausar un servicio lo deja
            fuera de la próxima sin borrar el histórico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServiciosContratados
            clientId={clientId}
            contratados={contratados}
            catalogo={catalogo}
          />
        </CardContent>
      </Card>

      <FichaFiscal
        clientId={clientId}
        perfil={(fiscal as PerfilFiscal | null) ?? null}
        nombreCliente={cliente?.name ?? ""}
      />

      <Card>
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
          <CardDescription>
            Todas las de este cliente, de la más reciente a la más antigua.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {facturas?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/facturacion/${f.id}`}
                        className="hover:underline"
                      >
                        {f.numero ?? "Borrador"}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {f.concepto || "—"}
                    </TableCell>
                    <TableCell>{fecha(f.fecha_emision)}</TableCell>
                    <TableCell>{fecha(f.fecha_vencimiento)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {euros(num(f.total))}
                    </TableCell>
                    <TableCell>
                      <EstadoFacturaBadge
                        estado={f.estado as EstadoFactura}
                        fechaVencimiento={f.fecha_vencimiento}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no se le ha facturado nada.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
