/**
 * Tipos y cuentas de la facturación, compartidos entre el panel de la agencia,
 * el del cliente y el generador de PDF.
 *
 * Todo el dinero se maneja en euros con dos decimales y se redondea en un solo
 * sitio (`redondear`). Los `numeric` de Postgres llegan como número o como
 * cadena según el driver, así que se normalizan al leerlos y nunca se opera con
 * lo que venga tal cual.
 */

export type EstadoFactura =
  | "borrador"
  | "emitida"
  | "enviada"
  | "pagada"
  | "anulada";

export type Recurrencia = "mensual" | "trimestral" | "anual" | "unico";

export type FormaPago =
  | "transferencia"
  | "domiciliacion"
  | "tarjeta"
  | "efectivo"
  | "otro";

export const RECURRENCIAS: { valor: Recurrencia; etiqueta: string }[] = [
  { valor: "mensual", etiqueta: "Mensual" },
  { valor: "trimestral", etiqueta: "Trimestral" },
  { valor: "anual", etiqueta: "Anual" },
  { valor: "unico", etiqueta: "Pago único" },
];

export const FORMAS_PAGO: { valor: FormaPago; etiqueta: string }[] = [
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "domiciliacion", etiqueta: "Domiciliación" },
  { valor: "tarjeta", etiqueta: "Tarjeta / enlace de pago" },
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "otro", etiqueta: "Otra" },
];

export const ESTADOS: Record<EstadoFactura, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  enviada: "Enviada",
  pagada: "Pagada",
  anulada: "Anulada",
};

/** Datos fiscales tal y como se congelan dentro de la factura al emitirla. */
export type DatosFiscales = {
  razon_social: string;
  nif: string;
  direccion: string;
  codigo_postal: string;
  ciudad: string;
  provincia: string;
  pais: string;
  email: string;
  telefono: string;
  web?: string;
  iban?: string;
};

export type LineaFactura = {
  id?: string;
  client_service_id?: string | null;
  concepto: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  posicion: number;
};

export type Factura = {
  id: string;
  agency_id: string;
  client_id: string;
  numero: string | null;
  estado: EstadoFactura;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  concepto: string;
  moneda: string;
  iva_pct: number;
  irpf_pct: number;
  base: number;
  iva: number;
  irpf: number;
  total: number;
  forma_pago: string;
  enlace_pago: string | null;
  emisor: DatosFiscales;
  receptor: DatosFiscales;
  notas: string;
  emitida_at: string | null;
  enviada_at: string | null;
  pagada_at: string | null;
  referencia_pago: string | null;
};

/** Céntimos enteros: sumar decimales de coma flotante acaba en 0,30000000004. */
export function redondear(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function num(valor: unknown): number {
  const n = typeof valor === "number" ? valor : parseFloat(String(valor ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function euros(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(num(n));
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Las fechas vienen como `date` (YYYY-MM-DD). Construir un Date con eso lo
  // interpreta en UTC y en España puede restar un día; se parte la cadena.
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Base, IVA, IRPF y total de una factura.
 *
 * El IRPF se calcula sobre la base, no sobre la base más el IVA: es una
 * retención a cuenta del emisor, no un impuesto sobre el total.
 */
export function calcularTotales(
  lineas: { cantidad: number; precio: number }[],
  ivaPct: number,
  irpfPct: number
) {
  const base = redondear(
    lineas.reduce((t, l) => t + num(l.cantidad) * num(l.precio), 0)
  );
  const iva = redondear((base * num(ivaPct)) / 100);
  const irpf = redondear((base * num(irpfPct)) / 100);
  return { base, iva, irpf, total: redondear(base + iva - irpf) };
}

/** Emitida o enviada, con la fecha de vencimiento pasada y sin cobrar. */
export function estaVencida(f: {
  estado: EstadoFactura;
  fecha_vencimiento: string | null;
}): boolean {
  if (f.estado !== "emitida" && f.estado !== "enviada") return false;
  if (!f.fecha_vencimiento) return false;
  return f.fecha_vencimiento < new Date().toISOString().slice(0, 10);
}

/** Suma meses a una fecha ISO sin salirse del mes (31 de enero + 1 mes = 28/29 de febrero). */
export function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)
  ).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «septiembre de 2026», para el concepto de las facturas recurrentes. */
export function nombreDelMes(iso: string): string {
  const [a, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** Cuántos meses cubre cada recurrencia. `unico` no se repite. */
export function mesesDe(recurrencia: Recurrencia): number | null {
  if (recurrencia === "mensual") return 1;
  if (recurrencia === "trimestral") return 3;
  if (recurrencia === "anual") return 12;
  return null;
}
