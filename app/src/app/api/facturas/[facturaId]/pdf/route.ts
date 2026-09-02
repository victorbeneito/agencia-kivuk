import { createClient } from "@/lib/supabase/server";
import { generarPdfFactura } from "@/lib/factura-pdf";
import type { DatosFiscales, Factura, LineaFactura } from "@/lib/facturacion";

/**
 * El PDF de una factura, para la agencia y para el cliente.
 *
 * Una sola ruta para los dos porque quién puede verla no lo decide este archivo:
 * se consulta con la sesión del usuario y son las políticas de la 0013 las que
 * responden. La agencia ve las suyas —borradores incluidos—, el cliente solo las
 * suyas y solo emitidas. Si la consulta no devuelve fila, es que no le
 * corresponde, y da igual quién sea.
 *
 * `nodejs` porque `pdf-lib` necesita Buffer y no funciona en el runtime edge.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ facturaId: string }> }
) {
  const { facturaId } = await params;
  const supabase = await createClient();

  const [{ data: facturaRaw }, { data: lineas }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", facturaId).single(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", facturaId)
      .order("posicion"),
  ]);

  if (!facturaRaw) {
    return new Response("Factura no encontrada.", { status: 404 });
  }

  const factura = facturaRaw as unknown as Factura;

  // Los ajustes solo los lee la agencia (RLS): para el cliente vuelve vacío y el
  // PDF sale sin el texto legal del pie, que es información de la agencia.
  const { data: ajustes } = await supabase
    .from("agency_billing_settings")
    .select("*")
    .eq("agency_id", factura.agency_id)
    .maybeSingle();

  // Un borrador todavía no tiene congelados los datos fiscales. Se rellenan con
  // los actuales para poder revisar cómo va a quedar antes de emitir.
  if (factura.estado === "borrador") {
    const { data: perfil } = await supabase
      .from("client_billing_profiles")
      .select("*")
      .eq("client_id", factura.client_id)
      .maybeSingle();

    const { data: cliente } = await supabase
      .from("clients")
      .select("name")
      .eq("id", factura.client_id)
      .maybeSingle();

    factura.emisor = {
      razon_social: ajustes?.razon_social ?? "",
      nif: ajustes?.nif ?? "",
      direccion: ajustes?.direccion ?? "",
      codigo_postal: ajustes?.codigo_postal ?? "",
      ciudad: ajustes?.ciudad ?? "",
      provincia: ajustes?.provincia ?? "",
      pais: ajustes?.pais ?? "",
      email: ajustes?.email ?? "",
      telefono: ajustes?.telefono ?? "",
      web: ajustes?.web ?? "",
      iban: ajustes?.iban ?? "",
    } satisfies DatosFiscales;

    factura.receptor = {
      razon_social: perfil?.razon_social || cliente?.name || "",
      nif: perfil?.nif ?? "",
      direccion: perfil?.direccion ?? "",
      codigo_postal: perfil?.codigo_postal ?? "",
      ciudad: perfil?.ciudad ?? "",
      provincia: perfil?.provincia ?? "",
      pais: perfil?.pais ?? "",
      email: perfil?.email ?? "",
      telefono: perfil?.telefono ?? "",
    } satisfies DatosFiscales;
  }

  const pdf = await generarPdfFactura({
    factura,
    lineas: (lineas ?? []) as LineaFactura[],
    pieFactura: ajustes?.pie_factura || undefined,
  });

  const nombre = `factura-${factura.numero ?? "borrador"}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline`: se abre en el visor del navegador, desde donde se descarga o
      // se imprime. Forzar la descarga es más molesto que útil cuando lo normal
      // es echarle un vistazo antes de mandarla.
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
