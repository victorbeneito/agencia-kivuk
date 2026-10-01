"use client";

import { useState, useTransition } from "react";
import { Ban, CheckCircle2, Download, Landmark, Send, Stamp, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { euros, type EstadoCobro, type EstadoFactura } from "@/lib/facturacion";
import {
  anularFactura,
  borrarBorrador,
  emitirFactura,
  enviarFactura,
  marcarPagada,
  marcarPendiente,
  type Resultado,
} from "../acciones";
import { cobrarPorDomiciliacion } from "../cobro";

/**
 * Los botones que mueven la factura de un estado al siguiente.
 *
 * El orden en pantalla es el orden real del ciclo de vida — emitir, enviar,
 * cobrar — y en cada momento solo se enseña lo que tiene sentido hacer. Anular y
 * borrar quedan aparte y en gris: son la salida de emergencia, no el camino.
 */
export function AccionesFactura({
  id,
  estado,
  emailCliente,
  domiciliacion,
}: {
  id: string;
  estado: EstadoFactura;
  emailCliente: string;
  /** Solo si la factura se paga por domiciliación. */
  domiciliacion?: { total: number; ultimos4: string | null; cobroEstado: EstadoCobro | null };
}) {
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [destino, setDestino] = useState(emailCliente);
  const [referencia, setReferencia] = useState("");
  const [cobrando, setCobrando] = useState(false);

  const emitida = estado === "emitida" || estado === "enviada";

  // Cargar por domiciliación: la factura ya avisada (enviada) y sin un cargo
  // vivo. Las demás condiciones —el plazo de aviso, que haya mandato— las
  // comprueba la acción y lo explica si falta algo.
  const puedeCargar =
    domiciliacion &&
    estado === "enviada" &&
    domiciliacion.cobroEstado !== "en_curso" &&
    domiciliacion.cobroEstado !== "cobrado";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/api/facturas/${id}/pdf`} target="_blank" rel="noreferrer" />}
        >
          <Download className="size-4" />
          PDF
        </Button>

        {estado === "borrador" && (
          <Button
            disabled={pendiente}
            onClick={() => empezar(async () => setResultado(await emitirFactura(id)))}
          >
            <Stamp className="size-4" />
            {pendiente ? "Emitiendo…" : "Emitir"}
          </Button>
        )}

        {emitida && !enviando && (
          <Button disabled={pendiente} onClick={() => setEnviando(true)}>
            <Send className="size-4" />
            Enviar por correo
          </Button>
        )}

        {puedeCargar && (
          <Button
            disabled={pendiente}
            onClick={() => {
              const cuenta = domiciliacion.ultimos4
                ? ` en la cuenta terminada en ${domiciliacion.ultimos4}`
                : "";
              if (!confirm(`¿Cargar ${euros(domiciliacion.total)}${cuenta}?`)) return;
              empezar(async () => setResultado(await cobrarPorDomiciliacion(id)));
            }}
          >
            <Landmark className="size-4" />
            {pendiente ? "Lanzando cargo…" : "Cobrar por domiciliación"}
          </Button>
        )}

        {emitida && !cobrando && (
          <Button variant="outline" onClick={() => setCobrando(true)}>
            <CheckCircle2 className="size-4" />
            Marcar cobrada
          </Button>
        )}

        {estado === "pagada" && (
          <Button
            variant="ghost"
            disabled={pendiente}
            onClick={() => empezar(() => marcarPendiente(id))}
          >
            <Undo2 className="size-4" />
            Deshacer cobro
          </Button>
        )}

        {estado === "borrador" ? (
          <Button
            variant="ghost"
            disabled={pendiente}
            onClick={() => {
              if (!confirm("¿Borrar este borrador? No se puede deshacer.")) return;
              empezar(() => borrarBorrador(id));
            }}
          >
            <Trash2 className="size-4 text-destructive" />
            Borrar borrador
          </Button>
        ) : (
          estado !== "anulada" && (
            <Button
              variant="ghost"
              disabled={pendiente}
              onClick={() => {
                if (
                  !confirm(
                    "¿Anular la factura? Se queda a la vista con su número, marcada como anulada: la numeración no puede tener huecos."
                  )
                )
                  return;
                empezar(() => anularFactura(id));
              }}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )
        )}
      </div>

      {enviando && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <label htmlFor="destino" className="text-sm font-medium">
              Enviar a
            </label>
            <Input
              id="destino"
              type="email"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="administracion@cliente.com"
            />
          </div>
          <Button
            disabled={pendiente || !destino}
            onClick={() =>
              empezar(async () => {
                const r = await enviarFactura(id, destino);
                setResultado(r);
                if (r.ok) setEnviando(false);
              })
            }
          >
            {pendiente ? "Enviando…" : "Enviar con el PDF adjunto"}
          </Button>
          <Button variant="ghost" onClick={() => setEnviando(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {cobrando && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <label htmlFor="referencia" className="text-sm font-medium">
              Referencia del cobro (opcional)
            </label>
            <Input
              id="referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Transferencia del 3/9, Stripe pi_123…"
            />
          </div>
          <Button
            disabled={pendiente}
            onClick={() =>
              empezar(async () => {
                await marcarPagada(id, referencia);
                setCobrando(false);
              })
            }
          >
            Confirmar cobro
          </Button>
          <Button variant="ghost" onClick={() => setCobrando(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {resultado && (
        <span
          className={`text-sm ${resultado.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {resultado.mensaje}
        </span>
      )}
    </div>
  );
}
