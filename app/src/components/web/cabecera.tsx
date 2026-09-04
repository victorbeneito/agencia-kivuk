import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { enlaceContacto } from "@/lib/web/kivuk";

const SECCIONES = [
  { href: "#servicios", texto: "Servicios" },
  { href: "#como-funciona", texto: "Cómo funciona" },
  { href: "#casos", texto: "Casos" },
  { href: "#precio", texto: "Precio" },
];

/**
 * Barra superior de la web pública.
 *
 * Dos destinos y no más: el botón de acción (WhatsApp) y la puerta del panel
 * para quien ya es cliente. Los enlaces de sección se esconden en móvil en vez
 * de plegarse en un menú — son anclas de una página corta, y un menú
 * desplegable obligaría a convertir toda la cabecera en componente de cliente
 * para ahorrar cuatro enlaces que se alcanzan bajando el dedo.
 */
export function Cabecera() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Kivuk Agencia — inicio">
          <Image
            src="/kivuk-logo.png"
            alt="Kivuk Agencia"
            width={800}
            height={407}
            priority
            className="h-11 w-auto object-contain object-left"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {SECCIONES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="text-sm font-medium text-kivuk-gris transition-colors hover:text-kivuk-azul-hondo"
            >
              {s.texto}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-kivuk-gris transition-colors hover:text-kivuk-azul-hondo sm:block"
          >
            Entrar
          </Link>
          <a
            href={enlaceContacto("Hola, os escribo desde la web de Kivuk.")}
            className="inline-flex items-center gap-2 rounded-lg bg-kivuk-azul-hondo px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-kivuk-pizarra"
          >
            <MessageCircle className="size-4" aria-hidden />
            Hablar con nosotros
          </a>
        </div>
      </div>
    </header>
  );
}
