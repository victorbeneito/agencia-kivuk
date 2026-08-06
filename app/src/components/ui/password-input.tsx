"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de contraseña con el ojo de ver/ocultar.
 *
 * En un móvil, escribir a ciegas una contraseña generada del tipo
 * `k7Fq2mXpR4wTz9` es garantía de equivocarse y no saber en qué. Poder mirar lo
 * que se ha escrito ahorra la mitad de los «no me deja entrar».
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // `tabIndex={-1}` para que tabular vaya del campo al botón de enviar y
        // no se quede aquí en medio.
        tabIndex={-1}
        aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
