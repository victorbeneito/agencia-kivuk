import { Download } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { clienteDelPanel } from "@/lib/auth";
import { EstadoFacturaBadge } from "@/components/estado-factura";
import { euros, fecha, num, type EstadoFactura } from "@/lib/facturacion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Las facturas, tal y como las ve el cliente.
 *
 * Solo lectura, y solo las emitidas: los borradores los filtra la RLS (0013), no
 * esta pantalla. Está pensada para el móvil, que es donde se abre el panel: una
 * tarjeta por factura en vez de una tabla que haya que arrastrar de lado.
 */
export default async function FacturasClientePage() {
  const contexto = await clienteDelPanel();
  const supabase = await createClient();

  const { data: facturas } = await supabase
    .from("invoices")
    .select(
      "id, numero, estado, fecha_emision, fecha_vencimiento, total, concepto, forma_pago, enlace_pago"
    )
    .eq("client_id", contexto.clientId)
    // La RLS del cliente ya deja fuera los borradores, pero la agencia mirando
    // este panel («ver su panel») los vería: no son suyos hasta que se emiten.
    .neq("estado", "borrador")
    .order("fecha_emision", { ascending: false });

  const lista = facturas ?? [];
  const pendientes = lista.filter(
    (f) => f.estado === "emitida" || f.estado === "enviada"
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Facturas</h1>
        <p className="text-sm text-muted-foreground">
          {pendientes.length
            ? `Tienes ${pendientes.length} ${
                pendientes.length === 1 ? "factura pendiente" : "facturas pendientes"
              } de pago.`
            : "Todo al día. Aquí quedan todas tus facturas."}
        </p>
      </div>

      {lista.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay facturas</CardTitle>
            <CardDescription>
              Cuando emitamos la primera, aparecerá aquí y te llegará por correo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {lista.map((f) => (
        <Card key={f.id}>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{f.numero}</p>
                <p className="text-sm text-muted-foreground">
                  {f.concepto || "Servicios"}
                </p>
              </div>
              <EstadoFacturaBadge
                estado={f.estado as EstadoFactura}
                fechaVencimiento={f.fecha_vencimiento}
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">Fecha: </span>
                {fecha(f.fecha_emision)}
              </span>
              <span>
                <span className="text-muted-foreground">Vence: </span>
                {fecha(f.fecha_vencimiento)}
              </span>
              <span className="font-semibold tabular-nums">{euros(num(f.total))}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/facturas/${f.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Download className="size-4" />
                Descargar PDF
              </a>
              {f.enlace_pago && f.estado !== "pagada" && (
                <a
                  href={f.enlace_pago}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--kivuk-terracota)] hover:underline"
                >
                  Pagar ahora
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
