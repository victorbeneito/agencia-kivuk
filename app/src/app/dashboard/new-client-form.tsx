"use client";

import { useRef, useState, useTransition } from "react";
import { createNewClient } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewClientForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createNewClient(formData);
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear el cliente.");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex items-start gap-2">
      <Input
        name="name"
        placeholder="Nombre del cliente nuevo"
        required
        className="max-w-xs"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creando..." : "Crear cliente"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
