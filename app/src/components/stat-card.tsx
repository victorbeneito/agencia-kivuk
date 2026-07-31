import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de métrica: rótulo, número grande e icono en un cuadrado de color.
 *
 * Los colores no son decorativos: cada uno identifica siempre lo mismo (azul =
 * actividad, arena = pendiente, salmón = atención), de modo que en un vistazo
 * se sabe qué mirar sin leer los rótulos.
 */
const TONOS = {
  azul: "bg-[#8EB9C5]/25 text-[#3b7686]",
  arena: "bg-[#D0BC82]/30 text-[#87752f]",
  terracota: "bg-[#B45831]/15 text-[#B45831]",
  verde: "bg-emerald-500/15 text-emerald-700",
} as const;

export function StatCard({
  icon: Icon,
  rotulo,
  valor,
  pie,
  tono = "azul",
  href,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string | number;
  pie?: string;
  tono?: keyof typeof TONOS;
  href?: string;
}) {
  const contenido = (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 transition-shadow",
        href && "hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{valor}</p>
          {pie && <p className="mt-1 text-xs text-muted-foreground">{pie}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", TONOS[tono])}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{contenido}</Link> : contenido;
}
