"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Images,
  MessageSquare,
  ReceiptEuro,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegación del panel en el móvil: una barra abajo, no una hamburguesa.
 *
 * El menú lateral funciona con ratón y es un desastre con el pulgar: hay que
 * estirarse a la esquina superior izquierda, esperar a que se despliegue un
 * panel encima de todo y volver a apuntar. Con tres o cuatro secciones, la barra
 * inferior es lo que hacen WhatsApp, Instagram y cualquier cosa que se use de
 * verdad en un teléfono: todo a un dedo de distancia y siempre a la vista.
 *
 * En escritorio no aparece — allí manda la barra lateral, que tiene sitio de
 * sobra y permite ver la sección activa sin gastar alto de pantalla.
 */
const ICONOS: Record<string, LucideIcon> = {
  inicio: Home,
  conversaciones: MessageSquare,
  contenido: Images,
  facturas: ReceiptEuro,
  cuenta: UserRound,
};

export type SeccionNav = {
  clave: string;
  titulo: string;
  url: string;
  exacto?: boolean;
  aviso?: number;
};

export function PanelNav({ secciones }: { secciones: SeccionNav[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:hidden"
      // El iPhone tiene una barra de gestos abajo que se come lo que haya
      // debajo. `env(safe-area-inset-bottom)` es el hueco que reserva el
      // sistema; sin esto, la fila de botones queda medio tapada al instalar
      // la app.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {secciones.map((s) => {
          const Icono = ICONOS[s.clave] ?? Home;
          const activa = s.exacto
            ? pathname === s.url
            : pathname.startsWith(s.url);

          return (
            <li key={s.url} className="flex-1">
              <Link
                href={s.url}
                className={cn(
                  // 64px de alto: por debajo de ~48 el dedo falla más de lo que
                  // acierta, y esta barra se usa con el móvil en una mano.
                  "relative flex h-16 flex-col items-center justify-center gap-1 transition-colors",
                  activa
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative">
                  <Icono className="size-6" />
                  {s.aviso ? (
                    <span className="absolute -right-2.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-[var(--kivuk-terracota)] px-1 text-[11px] font-medium text-white">
                      {s.aviso > 99 ? "99+" : s.aviso}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-medium">{s.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
