"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { enviarConsulta } from "./acciones";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * El camino para quien no quiere abrir WhatsApp.
 *
 * Cuatro campos: cuantos más se piden, menos se rellenan. El correo o el
 * teléfono van en un solo campo («cómo te localizamos») en vez de dos, porque
 * obligar a dar los dos es la forma más rápida de perder a quien solo quería
 * preguntar el precio.
 */
export function FormularioContacto() {
  const formRef = useRef<HTMLFormElement>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(
    null
  );
  const [enviando, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setResultado(null);
    startTransition(async () => {
      const r = await enviarConsulta(formData);
      setResultado(r);
      if (r.ok) formRef.current?.reset();
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tu nombre
          <Input name="nombre" required autoComplete="name" placeholder="Marta" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tu negocio
          <Input
            name="negocio"
            autoComplete="organization"
            placeholder="Cestería Aparici"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Cómo te localizamos
        <Input
          name="contacto"
          required
          placeholder="Correo o teléfono"
          autoComplete="email"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Qué necesitas
        <Textarea
          name="mensaje"
          rows={4}
          placeholder="Cuéntanos en dos líneas qué te llega hoy por WhatsApp y qué te gustaría que pasara con ello."
        />
      </label>

      {/* Trampa para robots: invisible para una persona, irresistible para un
          formulario relleno automáticamente. `tabIndex={-1}` y `aria-hidden`
          para que tampoco lo pise un lector de pantalla. */}
      <div className="hidden" aria-hidden>
        <label>
          No rellenar
          <input name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          name="consentimiento"
          required
          className="mt-0.5 size-4 shrink-0 accent-[var(--kivuk-azul-hondo)]"
        />
        <span>
          Acepto que Kivuk use estos datos para responderme. Nada más: ni listas,
          ni terceros.{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            Política de privacidad
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-kivuk-azul-hondo px-5 text-sm font-semibold text-white transition-colors hover:bg-kivuk-pizarra disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar"}
      </button>

      {resultado && (
        <p
          role="status"
          className={`text-sm ${
            resultado.ok ? "text-kivuk-azul-hondo" : "text-destructive"
          }`}
        >
          {resultado.mensaje}
        </p>
      )}
    </form>
  );
}
