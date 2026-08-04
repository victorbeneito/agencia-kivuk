"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { slug: "", etiqueta: "Resumen" },
  { slug: "contenido", etiqueta: "Contenido" },
  { slug: "conocimiento", etiqueta: "Conocimiento" },
  { slug: "conversaciones", etiqueta: "Conversaciones" },
  { slug: "configuracion", etiqueta: "Configuración" },
];

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${clientId}`;

  return (
    <nav className="flex gap-1 border-b">
      {SECCIONES.map(({ slug, etiqueta }) => {
        const href = slug ? `${base}/${slug}` : base;
        // El resumen solo se marca activo en su ruta exacta; el resto también
        // con sus subrutas (una conversación concreta, por ejemplo).
        const activa = slug ? pathname.startsWith(href) : pathname === base;

        return (
          <Link
            key={slug || "resumen"}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              activa
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
