"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Cambio de contraseña con la sesión del propio usuario.
 *
 * No pasa por una server action ni por `service_role`: `updateUser` actúa sobre
 * quien está conectado y no puede tocar a nadie más, que es exactamente la
 * garantía que se quiere aquí.
 */
const MINIMO = 8;

export function CambiarPassword() {
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (password.length < MINIMO) {
      setAviso({ ok: false, texto: `Usa al menos ${MINIMO} caracteres.` });
      return;
    }
    if (password !== repetida) {
      setAviso({ ok: false, texto: "Las dos contraseñas no coinciden." });
      return;
    }

    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setCargando(false);

    if (error) {
      setAviso({ ok: false, texto: `No se pudo cambiar: ${error.message}` });
      return;
    }

    setPassword("");
    setRepetida("");
    setAviso({ ok: true, texto: "Contraseña cambiada." });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña nueva</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="repetida">Repítela</Label>
        <Input
          id="repetida"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          required
        />
      </div>

      {aviso && (
        <p
          className={
            aviso.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"
          }
        >
          {aviso.texto}
        </p>
      )}

      <Button type="submit" disabled={cargando} className="w-fit">
        {cargando ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
