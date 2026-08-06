"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarAvisos, type Avisos } from "./acciones";

/**
 * Un aviso que no llega no sirve, y uno que llega de más se acaba ignorando:
 * por eso se elige. El del panel viene puesto porque solo lo nota quien ya lo
 * tiene abierto; el correo viene apagado porque se mete en la bandeja de
 * alguien sin pedir permiso.
 */
function Opcion({
  titulo,
  descripcion,
  marcado,
  onChange,
  disabled,
}: {
  titulo: string;
  descripcion: string;
  marcado: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        disabled ? "opacity-55" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={marcado}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-primary"
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="text-sm text-muted-foreground">{descripcion}</span>
      </span>
    </label>
  );
}

export function AvisosForm({ inicial }: { inicial: Avisos }) {
  const [avisos, setAvisos] = useState<Avisos>(inicial);
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);

  const cambiar = (patch: Partial<Avisos>) => {
    setAvisos((a) => ({ ...a, ...patch }));
    setResultado(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Opcion
        titulo="En el panel"
        descripcion="Un sonido y el número de mensajes en la pestaña del navegador, mientras lo tengas abierto."
        marcado={avisos.enPanel}
        onChange={(v) => cambiar({ enPanel: v })}
      />

      <Opcion
        titulo="Por correo"
        descripcion="Un email en cuanto alguien pide hablar con una persona. Útil si no vives con el panel abierto."
        marcado={avisos.porEmail}
        onChange={(v) => cambiar({ porEmail: v })}
      />

      {avisos.porEmail && (
        <div className="flex flex-col gap-2 pl-3">
          <Label htmlFor="email_avisos">¿A qué correo?</Label>
          <Input
            id="email_avisos"
            type="email"
            placeholder="quien-atiende@tunegocio.com"
            value={avisos.email}
            onChange={(e) => cambiar({ email: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            No tiene por qué ser el mismo con el que entras aquí: quien atiende
            el WhatsApp no siempre es quien lleva la cuenta.
          </p>
        </div>
      )}

      <Opcion
        titulo="En el móvil"
        descripcion="Notificación en el teléfono. Todavía no está disponible: llega cuando instalemos la aplicación."
        marcado={avisos.push}
        onChange={(v) => cambiar({ push: v })}
        disabled
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await guardarAvisos(avisos);
              setResultado({
                ok: r.ok,
                texto: r.ok ? "Guardado." : (r.mensaje ?? "No se pudo guardar."),
              });
            })
          }
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
        {resultado && (
          <span
            className={`text-sm ${
              resultado.ok ? "text-emerald-700" : "text-destructive"
            }`}
          >
            {resultado.texto}
          </span>
        )}
      </div>
    </div>
  );
}
