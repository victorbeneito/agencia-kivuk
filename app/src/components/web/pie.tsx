import Image from "next/image";
import Link from "next/link";
import { KIVUK, numeroLegible } from "@/lib/web/kivuk";

/**
 * Pie de la web pública.
 *
 * Además de los enlaces, cumple una obligación: el aviso legal y la política de
 * privacidad tienen que ser alcanzables desde cualquier página del sitio, y este
 * es el único sitio que aparece en todas.
 */
export function Pie() {
  const telefono = numeroLegible();

  return (
    <footer className="mt-auto border-t border-border bg-kivuk-pizarra text-[#d7dfe4]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Image
            src="/kivuk-marca.png"
            alt="Kivuk"
            width={256}
            height={361}
            className="h-9 w-auto"
          />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#d7dfe4]/70">
            Asistentes con IA para negocios que viven de atender bien: el WhatsApp
            contestado, la cita en el calendario y las redes al día, sin contratar
            a nadie más.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">La plataforma</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-[#d7dfe4]/70">
            {/* Con `/` delante y no solo el ancla: el pie sale también en el
                aviso legal y en privacidad, donde esas secciones no existen. */}
            <li>
              <Link href="/#que-hace" className="transition-colors hover:text-white">
                Qué hace
              </Link>
            </li>
            <li>
              <Link
                href="/#como-funciona"
                className="transition-colors hover:text-white"
              >
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link href="/#precio" className="transition-colors hover:text-white">
                Precio
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-white">
                Panel de cliente
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Contacto</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-[#d7dfe4]/70">
            <li>
              <a
                href={`mailto:${KIVUK.email}`}
                className="transition-colors hover:text-white"
              >
                {KIVUK.email}
              </a>
            </li>
            {telefono && (
              <li>
                <a
                  href={`https://wa.me/${telefono.replace(/\D/g, "")}`}
                  className="transition-colors hover:text-white"
                >
                  {telefono}
                </a>
              </li>
            )}
            {KIVUK.instagram && (
              <li>
                <a
                  href={`https://instagram.com/${KIVUK.instagram}`}
                  className="transition-colors hover:text-white"
                >
                  @{KIVUK.instagram}
                </a>
              </li>
            )}
            <li>
              <Link href="/aviso-legal" className="transition-colors hover:text-white">
                Aviso legal
              </Link>
            </li>
            <li>
              <Link href="/privacidad" className="transition-colors hover:text-white">
                Privacidad
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-5">
        <p className="mx-auto w-full max-w-6xl text-xs text-[#d7dfe4]/50">
          © {new Date().getFullYear()} {KIVUK.nombre}. Hecho con la misma
          plataforma que vendemos.
        </p>
      </div>
    </footer>
  );
}
