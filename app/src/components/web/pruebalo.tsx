import Image from "next/image";
import { MessageCircle, Scissors, Stethoscope, Activity } from "lucide-react";

import { DEMOS, enlaceDemo, type Demo } from "@/lib/web/demos";

const ICONO: Record<string, typeof Scissors> = {
  peluqueria: Scissors,
  dental: Stethoscope,
  fisio: Activity,
};

/**
 * «Pruébalo tú mismo»: tres demos reales, una por sector.
 *
 * Es la única sección que manda a un WhatsApp que no es el de Kivuk, y eso va
 * en contra de la regla de la landing —una sola acción—. Se acepta porque es la
 * prueba más barata de dar y la más difícil de discutir: leer que el bot sabe
 * precios convence a medias, y escribirle a las once de la noche desde el sofá
 * convence del todo. Para que no se lleve la visita por delante, la demo es la
 * de **su** sector (nada de elegir entre cinco) y el propio bot invita a hablar
 * con Kivuk cuando le preguntan quién está detrás.
 *
 * En el móvil se pulsa y se abre el chat; en el ordenador se enseña el QR,
 * porque nadie prueba un bot de WhatsApp en WhatsApp Web. No hay JavaScript
 * detrás: las dos cosas se pintan siempre y es el CSS el que enseña una u otra,
 * así que la sección funciona igual con el móvil en la mano o con el portátil.
 */
export function Pruebalo() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {DEMOS.map((demo) => (
        <Tarjeta key={demo.slug} demo={demo} />
      ))}
    </div>
  );
}

function Tarjeta({ demo }: { demo: Demo }) {
  const Icono = ICONO[demo.slug] ?? MessageCircle;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <Icono className="size-6 text-kivuk-terracota" aria-hidden />

      <h3 className="mt-4 text-lg font-semibold text-kivuk-pizarra">
        {demo.sector}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-kivuk-gris">{demo.sabe}</p>

      <p className="mt-4 rounded-xl bg-secondary/60 px-4 py-3 text-sm text-kivuk-pizarra italic">
        «{demo.pregunta}»
      </p>

      <div className="mt-5 flex flex-1 flex-col justify-end">
        {/* Móvil: el enlace abre la conversación con la pregunta ya escrita. */}
        <a
          href={enlaceDemo(demo)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-kivuk-pizarra px-5 text-sm font-medium text-white transition-colors hover:bg-kivuk-pizarra/90 sm:hidden"
        >
          <MessageCircle className="size-4" aria-hidden />
          Abrir el chat
        </a>

        {/* Ordenador: el QR, para seguir en el móvil, que es donde se usa. */}
        <div className="hidden flex-col items-center sm:flex">
          <a href={enlaceDemo(demo)} target="_blank" rel="noopener noreferrer">
            <Image
              src={demo.qr}
              alt={`Código QR para escribir al asistente de ${demo.sector} por WhatsApp`}
              width={560}
              height={560}
              className="size-36 rounded-xl border border-border"
            />
          </a>
          <p className="mt-3 text-center text-xs text-kivuk-gris">
            Escanéalo con la cámara del móvil
            <br />
            <span className="tabular-nums">{demo.visible}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
