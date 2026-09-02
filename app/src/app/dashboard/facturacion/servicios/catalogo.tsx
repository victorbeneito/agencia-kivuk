"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { euros, RECURRENCIAS, type Recurrencia } from "@/lib/facturacion";
import { borrarServicio, guardarServicio } from "../acciones";

/**
 * El catálogo es la tarifa de la agencia, no lo que paga nadie en concreto.
 *
 * Sirve para dos cosas: no tener que reescribir el mismo concepto en cada
 * cliente, y saber a qué precio se vende cada cosa cuando llega el momento de
 * decidir si sube. Lo que un cliente concreto paga se decide al contratárselo,
 * y desde ese momento ya no depende de esta lista.
 */
export type Servicio = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  recurrencia: Recurrencia;
  modulo: string | null;
  activo: boolean;
};

const MODULOS = [
  { valor: "", etiqueta: "Sin módulo" },
  { valor: "whatsapp", etiqueta: "WhatsApp" },
  { valor: "voice", etiqueta: "Agente de voz" },
  { valor: "calendar", etiqueta: "Agenda" },
  { valor: "email", etiqueta: "Correos" },
  { valor: "social", etiqueta: "Redes sociales" },
];

const claseSelect =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs";

function FormularioServicio({
  servicio,
  onHecho,
}: {
  servicio?: Servicio;
  onHecho: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await guardarServicio(formData);
        onHecho();
      }}
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      {servicio && <input type="hidden" name="id" value={servicio.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`nombre-${servicio?.id ?? "nuevo"}`}>Servicio</Label>
          <Input
            id={`nombre-${servicio?.id ?? "nuevo"}`}
            name="nombre"
            required
            defaultValue={servicio?.nombre}
            placeholder="Asistente de WhatsApp con IA"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`precio-${servicio?.id ?? "nuevo"}`}>Precio (€)</Label>
          <Input
            id={`precio-${servicio?.id ?? "nuevo"}`}
            name="precio"
            type="number"
            step="0.01"
            min="0"
            defaultValue={servicio?.precio ?? 0}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`recurrencia-${servicio?.id ?? "nuevo"}`}>
            Facturación
          </Label>
          <select
            id={`recurrencia-${servicio?.id ?? "nuevo"}`}
            name="recurrencia"
            defaultValue={servicio?.recurrencia ?? "mensual"}
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
          <Label htmlFor={`modulo-${servicio?.id ?? "nuevo"}`}>
            Módulo de la plataforma
          </Label>
          <select
            id={`modulo-${servicio?.id ?? "nuevo"}`}
            name="modulo"
            defaultValue={servicio?.modulo ?? ""}
            className={claseSelect}
          >
            {MODULOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`descripcion-${servicio?.id ?? "nuevo"}`}>
          Descripción (sale en la factura)
        </Label>
        <Textarea
          id={`descripcion-${servicio?.id ?? "nuevo"}`}
          name="descripcion"
          rows={2}
          defaultValue={servicio?.descripcion}
          placeholder="Atención automática 24/7, relevo humano y bandeja en el panel."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Guardar</Button>
        <Button type="button" variant="ghost" onClick={onHecho}>
          Cancelar
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="activo"
            value="si"
            defaultChecked={servicio?.activo ?? true}
          />
          En venta
        </label>
      </div>
    </form>
  );
}

export function Catalogo({ servicios }: { servicios: Servicio[] }) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [, empezar] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {creando ? (
        <FormularioServicio onHecho={() => setCreando(false)} />
      ) : (
        <Button className="w-fit" onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      )}

      {servicios.length === 0 && !creando && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay servicios. Empieza por los que ya vendes: el asistente
          de WhatsApp, el contenido de redes, la puesta en marcha.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {servicios.map((s) =>
          editando === s.id ? (
            <FormularioServicio
              key={s.id}
              servicio={s}
              onHecho={() => setEditando(null)}
            />
          ) : (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {s.nombre}
                  {!s.activo && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Retirado
                    </span>
                  )}
                </p>
                {s.descripcion && (
                  <p className="text-sm text-muted-foreground">{s.descripcion}</p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm tabular-nums">
                  <strong>{euros(s.precio)}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    /{" "}
                    {RECURRENCIAS.find((r) => r.valor === s.recurrencia)?.etiqueta.toLowerCase()}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar"
                  onClick={() => setEditando(s.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Borrar"
                  onClick={() => {
                    if (
                      !confirm(
                        `¿Borrar «${s.nombre}» del catálogo? Lo que ya tengan contratado tus clientes no se toca.`
                      )
                    )
                      return;
                    empezar(() => borrarServicio(s.id));
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
