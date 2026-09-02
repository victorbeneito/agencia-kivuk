"use client";

import { useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  euros,
  FORMAS_PAGO,
  num,
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
import { actualizarFactura, anadirLinea, borrarLinea } from "../acciones";

/**
 * Edición de un borrador.
 *
 * Solo aparece mientras la factura es borrador: en cuanto se emite, el
 * documento se congela y esta pantalla se sustituye por la vista de lectura. La
 * comprobación de verdad está en las server actions, esto es únicamente no
 * enseñar campos que no se van a poder guardar.
 */
const claseSelect =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs";

export function EditorFactura({
  factura,
  lineas,
}: {
  factura: Factura;
  lineas: LineaFactura[];
}) {
  const [pendiente, empezar] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        action={actualizarFactura}
        className="flex flex-col gap-4 rounded-xl border bg-card p-4"
      >
        <input type="hidden" name="id" value={factura.id} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha_emision">Fecha de emisión</Label>
            <Input
              id="fecha_emision"
              name="fecha_emision"
              type="date"
              defaultValue={factura.fecha_emision?.slice(0, 10)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha_vencimiento">Vencimiento</Label>
            <Input
              id="fecha_vencimiento"
              name="fecha_vencimiento"
              type="date"
              defaultValue={factura.fecha_vencimiento?.slice(0, 10) ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="periodo_inicio">Periodo desde</Label>
            <Input
              id="periodo_inicio"
              name="periodo_inicio"
              type="date"
              defaultValue={factura.periodo_inicio?.slice(0, 10) ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="periodo_fin">Periodo hasta</Label>
            <Input
              id="periodo_fin"
              name="periodo_fin"
              type="date"
              defaultValue={factura.periodo_fin?.slice(0, 10) ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="concepto">Concepto</Label>
          <Input
            id="concepto"
            name="concepto"
            defaultValue={factura.concepto}
            placeholder="Servicios de septiembre de 2026"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="iva_pct">IVA (%)</Label>
            <Input
              id="iva_pct"
              name="iva_pct"
              type="number"
              step="0.01"
              min="0"
              defaultValue={num(factura.iva_pct)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="irpf_pct">Retención IRPF (%)</Label>
            <Input
              id="irpf_pct"
              name="irpf_pct"
              type="number"
              step="0.01"
              min="0"
              defaultValue={num(factura.irpf_pct)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pago">Forma de pago</Label>
            <select
              id="forma_pago"
              name="forma_pago"
              defaultValue={factura.forma_pago}
              className={claseSelect}
            >
              {FORMAS_PAGO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="enlace_pago">Enlace de pago (opcional)</Label>
            <Input
              id="enlace_pago"
              name="enlace_pago"
              defaultValue={factura.enlace_pago ?? ""}
              placeholder="https://buy.stripe.com/…"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notas">Notas (salen en la factura)</Label>
          <Textarea
            id="notas"
            name="notas"
            rows={2}
            defaultValue={factura.notas}
            placeholder="Gracias por confiar en nosotros. Pago a 15 días."
          />
        </div>

        <Button type="submit" className="w-fit">
          Guardar cambios
        </Button>
      </form>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead />
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
                <TableCell className="w-10">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar línea"
                    disabled={pendiente}
                    onClick={() => empezar(() => borrarLinea(factura.id, l.id!))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {lineas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Sin líneas todavía. Una factura sin líneas no se puede emitir.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form
          action={anadirLinea}
          className="flex flex-wrap items-end gap-3 border-t p-4"
        >
          <input type="hidden" name="invoice_id" value={factura.id} />

          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <Label htmlFor="concepto-linea">Nueva línea</Label>
            <Input
              id="concepto-linea"
              name="concepto"
              required
              placeholder="Campaña de septiembre"
            />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <Label htmlFor="descripcion-linea">Detalle (opcional)</Label>
            <Input
              id="descripcion-linea"
              name="descripcion"
              placeholder="12 piezas y 4 reels"
            />
          </div>
          <div className="flex w-20 flex-col gap-2">
            <Label htmlFor="cantidad-linea">Cant.</Label>
            <Input
              id="cantidad-linea"
              name="cantidad"
              type="number"
              step="0.01"
              defaultValue={1}
            />
          </div>
          <div className="flex w-28 flex-col gap-2">
            <Label htmlFor="precio-linea">Precio (€)</Label>
            <Input
              id="precio-linea"
              name="precio"
              type="number"
              step="0.01"
              defaultValue={0}
            />
          </div>
          <Button type="submit" variant="outline">
            <Plus className="size-4" />
            Añadir
          </Button>
        </form>
      </div>
    </div>
  );
}
