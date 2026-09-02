"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { euros, fecha, RECURRENCIAS, type Recurrencia } from "@/lib/facturacion";
import {
  borrarContratado,
  cambiarEstadoContratado,
  contratarServicio,
} from "@/app/dashboard/facturacion/acciones";

/**
 * Lo que este cliente paga, y cada cuánto.
 *
 * Es la fuente de la facturación recurrente: el botón «Generar facturas del
 * periodo» no mira los módulos activos, mira esta lista. Están separados a
 * propósito — un cliente puede tener el módulo de WhatsApp encendido durante un
 * mes de prueba sin que eso genere una factura, y puede pagar una puesta en
 * marcha que no se corresponde con ningún módulo.
 */
export type Contratado = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  recurrencia: Recurrencia;
  estado: "activo" | "pausado" | "cancelado";
  fecha_alta: string;
  proxima_factura: string | null;
};

const claseSelect =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs";

const TONO_ESTADO: Record<string, string> = {
  activo: "bg-emerald-500/15 text-emerald-700",
  pausado: "bg-[#D0BC82]/30 text-[#87752f]",
  cancelado: "bg-muted text-muted-foreground",
};

export function ServiciosContratados({
  clientId,
  contratados,
  catalogo,
}: {
  clientId: string;
  contratados: Contratado[];
  catalogo: { id: string; nombre: string; precio: number; recurrencia: string }[];
}) {
  const [anadiendo, setAnadiendo] = useState(false);
  const [elegido, setElegido] = useState("");
  const [pendiente, empezar] = useTransition();

  const delCatalogo = catalogo.find((c) => c.id === elegido);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {contratados.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no tiene nada contratado. Mientras esté así, no entrará en la
            facturación del mes.
          </p>
        )}

        {contratados.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {c.nombre}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONO_ESTADO[c.estado]}`}
                >
                  {c.estado === "activo"
                    ? "Activo"
                    : c.estado === "pausado"
                      ? "Pausado"
                      : "Cancelado"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {euros(c.precio)}
                {c.cantidad !== 1 ? ` × ${c.cantidad}` : ""} ·{" "}
                {RECURRENCIAS.find((r) => r.valor === c.recurrencia)?.etiqueta}
                {c.estado === "activo" && c.proxima_factura
                  ? ` · siguiente: ${fecha(c.proxima_factura)}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {c.estado === "activo" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendiente}
                  onClick={() =>
                    empezar(() => cambiarEstadoContratado(clientId, c.id, "pausado"))
                  }
                >
                  <Pause className="size-3.5" />
                  Pausar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendiente}
                  onClick={() =>
                    empezar(() => cambiarEstadoContratado(clientId, c.id, "activo"))
                  }
                >
                  <Play className="size-3.5" />
                  Reanudar
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Quitar"
                disabled={pendiente}
                onClick={() => {
                  if (
                    !confirm(
                      `¿Quitar «${c.nombre}»? Las facturas ya emitidas no cambian.`
                    )
                  )
                    return;
                  empezar(() => borrarContratado(clientId, c.id));
                }}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {anadiendo ? (
        <form
          action={async (formData) => {
            await contratarServicio(formData);
            setAnadiendo(false);
            setElegido("");
          }}
          className="flex flex-col gap-4 rounded-lg border bg-card p-4"
        >
          <input type="hidden" name="client_id" value={clientId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="service_id">Del catálogo</Label>
              <select
                id="service_id"
                name="service_id"
                value={elegido}
                onChange={(e) => setElegido(e.target.value)}
                className={claseSelect}
              >
                <option value="">Servicio a medida</option>
                {catalogo.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} — {euros(s.precio)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">Nombre en la factura</Label>
              <Input
                id="nombre"
                name="nombre"
                key={elegido}
                defaultValue={delCatalogo?.nombre ?? ""}
                placeholder="Asistente de WhatsApp con IA"
                required={!elegido}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="precio">Precio acordado (€)</Label>
              <Input
                id="precio"
                name="precio"
                type="number"
                step="0.01"
                key={`precio-${elegido}`}
                defaultValue={delCatalogo?.precio ?? 0}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="recurrencia">Facturación</Label>
              <select
                id="recurrencia"
                name="recurrencia"
                key={`rec-${elegido}`}
                defaultValue={delCatalogo?.recurrencia ?? "mensual"}
                className={claseSelect}
              >
                {RECURRENCIAS.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="descripcion">Detalle (opcional)</Label>
              <Input
                id="descripcion"
                name="descripcion"
                placeholder="Incluye 1.000 conversaciones al mes"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha_alta">Desde</Label>
              <Input
                id="fecha_alta"
                name="fecha_alta"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            El precio se copia aquí y ya no depende del catálogo: si mañana subes
            la tarifa, este cliente sigue pagando lo acordado hasta que lo cambies
            a mano.
          </p>

          <div className="flex gap-3">
            <Button type="submit">Contratar</Button>
            <Button type="button" variant="ghost" onClick={() => setAnadiendo(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="w-fit" onClick={() => setAnadiendo(true)}>
          <Plus className="size-4" />
          Añadir servicio contratado
        </Button>
      )}
    </div>
  );
}
