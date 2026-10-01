import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { EstadoFacturaBadge } from "@/components/estado-factura";
import {
  euros,
  fecha,
  num,
  type DatosFiscales,
  type Factura,
  type LineaFactura,
} from "@/lib/facturacion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccionesFactura } from "./acciones-factura";
import { EditorFactura } from "./editor";

/** Bloque de datos fiscales: el mismo para emisor y receptor. */
function Parte({ titulo, datos }: { titulo: string; datos: DatosFiscales }) {
  const cp = [datos.codigo_postal, datos.ciudad].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <p className="font-medium">{datos.razon_social || "—"}</p>
      {datos.nif && <p className="text-muted-foreground">NIF {datos.nif}</p>}
      {datos.direccion && <p className="text-muted-foreground">{datos.direccion}</p>}
      {(cp || datos.provincia) && (
        <p className="text-muted-foreground">
          {[cp, datos.provincia].filter(Boolean).join(", ")}
        </p>
      )}
      {datos.email && <p className="text-muted-foreground">{datos.email}</p>}
    </div>
  );
}

/**
 * En qué punto está el cargo por domiciliación, cuando la factura se paga así.
 *
 * Un adeudo SEPA tarda días en confirmarse y puede volver semanas después: sin
 * esta línea, una factura con el cargo lanzado parecería igual de pendiente que
 * una que nadie ha tocado.
 */
function EstadoDelCobro({ factura, tieneMandato }: { factura: Factura; tieneMandato: boolean }) {
  if (factura.forma_pago !== "domiciliacion") return null;
  if (["borrador", "pagada", "anulada"].includes(factura.estado)) return null;

  const aviso = (clase: string, texto: string) => (
    <p className={`rounded-lg border px-4 py-3 text-sm ${clase}`}>{texto}</p>
  );
  const rojo = "border-destructive/30 bg-destructive/5 text-destructive";

  switch (factura.cobro_estado) {
    case "cobrado":
      return null;
    case "en_curso":
      return aviso(
        "border-sky-200 bg-sky-50 text-sky-900",
        `Cargo lanzado el ${fecha(factura.cobro_iniciado_at)}. El banco del cliente tarda unos días hábiles en confirmarlo; cuando lo haga, la factura se marcará como cobrada sola.`
      );
    case "fallido":
      return aviso(
        rojo,
        `El cargo ha fallado: ${factura.cobro_error ?? "sin motivo."} Puedes volver a lanzarlo o pedirle otra forma de pago.`
      );
    case "devuelto":
      return aviso(
        rojo,
        `${factura.cobro_error ?? "Recibo devuelto."} Habla con el cliente antes de volver a cargarlo.`
      );
  }

  if (!tieneMandato) {
    return aviso(
      "border-amber-200 bg-amber-50 text-amber-900",
      "Se paga por domiciliación, pero el cliente todavía no la ha firmado. El enlace está en su pestaña de Facturación."
    );
  }

  if (factura.estado === "emitida") {
    return aviso(
      "border-border bg-muted/40 text-muted-foreground",
      "Se paga por domiciliación. Primero envíala por correo: ese correo es el aviso del cargo, y dos días después ya se puede cobrar."
    );
  }

  return null;
}

export default async function FacturaPage({
  params,
}: {
  params: Promise<{ facturaId: string }>;
}) {
  const { facturaId } = await params;
  await requireAgencia();
  const supabase = await createClient();

  const [{ data: facturaRaw }, { data: lineasRaw }] = await Promise.all([
    supabase.from("invoices").select("*, clients(name)").eq("id", facturaId).single(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", facturaId)
      .order("posicion"),
  ]);

  if (!facturaRaw) notFound();

  const factura = facturaRaw as unknown as Factura & {
    clients: { name: string } | null;
  };
  const lineas = (lineasRaw ?? []) as LineaFactura[];
  const esBorrador = factura.estado === "borrador";

  // En un borrador todavía no hay copia congelada de los datos fiscales: se
  // enseñan los actuales como anticipo de lo que saldrá al emitir.
  const [{ data: ajustes }, { data: perfil }] = await Promise.all([
    supabase
      .from("agency_billing_settings")
      .select("*")
      .eq("agency_id", factura.agency_id)
      .maybeSingle(),
    supabase
      .from("client_billing_profiles")
      .select("*")
      .eq("client_id", factura.client_id)
      .maybeSingle(),
  ]);

  const emisor: DatosFiscales = esBorrador
    ? {
        razon_social: ajustes?.razon_social ?? "",
        nif: ajustes?.nif ?? "",
        direccion: ajustes?.direccion ?? "",
        codigo_postal: ajustes?.codigo_postal ?? "",
        ciudad: ajustes?.ciudad ?? "",
        provincia: ajustes?.provincia ?? "",
        pais: ajustes?.pais ?? "",
        email: ajustes?.email ?? "",
        telefono: ajustes?.telefono ?? "",
        iban: ajustes?.iban ?? "",
      }
    : factura.emisor;

  const receptor: DatosFiscales = esBorrador
    ? {
        razon_social: perfil?.razon_social || factura.clients?.name || "",
        nif: perfil?.nif ?? "",
        direccion: perfil?.direccion ?? "",
        codigo_postal: perfil?.codigo_postal ?? "",
        ciudad: perfil?.ciudad ?? "",
        provincia: perfil?.provincia ?? "",
        pais: perfil?.pais ?? "",
        email: perfil?.email ?? "",
        telefono: perfil?.telefono ?? "",
      }
    : factura.receptor;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/facturacion"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a facturación
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">
            {factura.numero ?? "Borrador sin numerar"}
          </h1>
          <EstadoFacturaBadge
            estado={factura.estado}
            fechaVencimiento={factura.fecha_vencimiento}
          />
          <Link
            href={`/dashboard/${factura.client_id}/facturacion`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {factura.clients?.name}
          </Link>
        </div>

        {esBorrador && (
          <p className="text-sm text-muted-foreground">
            Mientras sea borrador no tiene número y se puede cambiar todo. Al
            emitirla se le asigna el siguiente número de la serie y queda
            cerrada.
          </p>
        )}
      </div>

      <AccionesFactura
        id={factura.id}
        estado={factura.estado}
        emailCliente={receptor.email ?? ""}
        domiciliacion={
          factura.forma_pago === "domiciliacion"
            ? {
                total: num(factura.total),
                ultimos4: perfil?.sepa_ultimos4 ?? null,
                cobroEstado: factura.cobro_estado,
              }
            : undefined
        }
      />

      <EstadoDelCobro factura={factura} tieneMandato={Boolean(perfil?.sepa_mandate_id)} />

      <div className="grid gap-6 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Parte titulo="De" datos={emisor} />
        <Parte titulo="Para" datos={receptor} />

        <div className="text-sm sm:col-span-2">
          <div className="grid gap-1 sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Emisión: </span>
              {fecha(factura.fecha_emision)}
            </p>
            <p>
              <span className="text-muted-foreground">Vencimiento: </span>
              {fecha(factura.fecha_vencimiento)}
            </p>
            {factura.periodo_inicio && (
              <p>
                <span className="text-muted-foreground">Periodo: </span>
                {fecha(factura.periodo_inicio)} – {fecha(factura.periodo_fin)}
              </p>
            )}
          </div>
          {factura.concepto && <p className="mt-2 font-medium">{factura.concepto}</p>}
        </div>
      </div>

      {esBorrador ? (
        <EditorFactura factura={factura} lineas={lineas} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium">{l.concepto}</span>
                    {l.descripcion && (
                      <span className="block text-xs text-muted-foreground">
                        {l.descripcion}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(l.cantidad)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euros(num(l.precio))}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {euros(num(l.cantidad) * num(l.precio))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="ml-auto flex w-full max-w-sm flex-col gap-1 rounded-xl border bg-card p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base imponible</span>
          <span className="tabular-nums">{euros(factura.base)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IVA {num(factura.iva_pct)}%</span>
          <span className="tabular-nums">{euros(factura.iva)}</span>
        </div>
        {num(factura.irpf_pct) > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Retención IRPF {num(factura.irpf_pct)}%
            </span>
            <span className="tabular-nums">-{euros(factura.irpf)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{euros(factura.total)}</span>
        </div>
        {factura.pagada_at && (
          <p className="mt-2 text-xs text-emerald-700">
            Cobrada el {fecha(factura.pagada_at.slice(0, 10))}
            {factura.referencia_pago ? ` · ${factura.referencia_pago}` : ""}
          </p>
        )}
        {factura.enviada_at && !factura.pagada_at && (
          <p className="mt-2 text-xs text-muted-foreground">
            Enviada el {fecha(factura.enviada_at.slice(0, 10))}
          </p>
        )}
      </div>
    </div>
  );
}
