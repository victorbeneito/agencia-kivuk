"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

function Formulario() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    // El middleware manda aquí a quien tiene sesión pero ninguna ficha en
    // `user_profiles`: sin ella no se sabe de qué agencia o cliente es.
    searchParams.get("sin_perfil")
      ? "Tu usuario no tiene todavía un panel asignado. Avísanos y lo activamos."
      : null
  );
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setCargando(false);
      setError("Email o contraseña incorrectos.");
      return;
    }

    // A `/entrar`, no a un panel concreto: es esa ruta la que sabe si este
    // usuario es de la agencia o de un cliente. Así el login no tiene que
    // enterarse. (La raíz `/` es la web pública desde que existe la landing.)
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-8 shadow-sm"
    >
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/kivuk-logo.png"
          alt="Kivuk Agencia"
          width={800}
          height={407}
          priority
          className="h-[76px] w-auto object-contain"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={cargando} className="w-full">
        {cargando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <Formulario />
      </Suspense>
    </main>
  );
}
