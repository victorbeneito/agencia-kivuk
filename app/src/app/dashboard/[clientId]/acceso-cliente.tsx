"use client";

import { useState, useTransition } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  crearAccesoCliente,
  eliminarAccesoCliente,
  restablecerPasswordCliente,
  type ResultadoAcceso,
} from "./acceso";

export type UsuarioCliente = {
  id: string;
  email: string;
  ultimoAcceso: string | null;
};

/**
 * Alta y mantenimiento de los usuarios del cliente.
 *
 * La contraseña se enseña una sola vez, aquí, en el momento de generarla:
 * Supabase la guarda cifrada y no hay forma de volver a verla. Si se pierde, se
 * genera otra — que es justo lo que hace el botón de la llave.
 */
export function AccesoCliente({
  clientId,
  usuarios,
}: {
  clientId: string;
  usuarios: UsuarioCliente[];
}) {
  const [email, setEmail] = useState("");
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoAcceso | null>(null);

  function ejecutar(accion: () => Promise<ResultadoAcceso>) {
    empezar(async () => {
      const r = await accion();
      setResultado(r);
      if (r.ok) setEmail("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {usuarios.length > 0 && (
        <ul className="flex flex-col gap-2">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{u.email}</span>
                <span className="text-xs text-muted-foreground">
                  {u.ultimoAcceso
                    ? `Última entrada: ${new Date(u.ultimoAcceso).toLocaleString("es-ES")}`
                    : "Todavía no ha entrado"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendiente}
                  onClick={() =>
                    ejecutar(() => restablecerPasswordCliente(clientId, u.id))
                  }
                >
                  <KeyRound className="size-4" />
                  Nueva contraseña
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendiente}
                  onClick={() => {
                    if (
                      !confirm(
                        `¿Quitar el acceso de ${u.email}? Dejará de poder entrar al panel.`
                      )
                    )
                      return;
                    ejecutar(() => eliminarAccesoCliente(clientId, u.id));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <Label htmlFor="email_acceso">Email del cliente</Label>
          <Input
            id="email_acceso"
            type="email"
            placeholder="persona@negocio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button
          disabled={pendiente || !email.trim()}
          onClick={() => ejecutar(() => crearAccesoCliente(clientId, email))}
        >
          <UserPlus className="size-4" />
          {pendiente ? "Creando…" : "Crear acceso"}
        </Button>
      </div>

      {resultado && !pendiente && (
        <div
          className={
            resultado.ok
              ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950"
              : "text-sm text-destructive"
          }
        >
          <p>{resultado.mensaje}</p>
          {resultado.password && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-muted-foreground">
                Contraseña temporal (cópiala ahora, no se puede volver a ver):
              </span>
              <code className="w-fit rounded-md bg-background px-3 py-1.5 font-mono text-base tracking-wide">
                {resultado.password}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
