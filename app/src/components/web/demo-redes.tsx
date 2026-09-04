import Image from "next/image";
import { Heart, MessageCircle } from "lucide-react";

/**
 * La pieza antes de salir a Instagram.
 *
 * Es la publicación real de @hogardetusuenos (el estor de la Torre Eiffel),
 * no una inventada: `docs/marketing-y-captacion.md` es explícito en que las
 * fotos salen siempre del catálogo real del cliente, nunca de la IA, y esta
 * es la única de las tres pestañas en producción donde la propia tienda tiene
 * contenido real que enseñar — WhatsApp y Agenda usan a la cestería en su
 * lugar porque ahí sí existen de verdad.
 *
 * La proporción es 4:5 (1080×1350), la del archivo original, y no el 1:1 que
 * llevaba el degradado que sustituye: es el formato vertical que de verdad usa
 * Instagram, no un cuadrado inventado.
 */
export function DemoRedes() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_-20px_rgba(43,63,77,0.35)]">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kivuk-azul-hondo text-xs font-semibold text-white">
          HS
        </div>
        <p className="text-sm font-semibold text-kivuk-pizarra">
          Hogar de tus Sueños
        </p>
      </div>

      <div className="relative aspect-[4/5] bg-secondary">
        <Image
          src="/casos/hogar-estor-paris.png"
          alt="Estor digital con la Torre Eiffel, publicado en @hogardetusuenos"
          fill
          sizes="(min-width: 640px) 384px, 90vw"
          className="object-cover"
        />
      </div>

      <div className="space-y-3 p-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-kivuk-pizarra">
          París entra en tu salón. Un estor enrollable digital con la Torre
          Eiffel para transformar la ventana en un punto focal con carácter,
          luz y estilo. Descubre los estores digitales en
          www.elhogardetusuenos.com
        </p>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3 text-kivuk-gris">
            <Heart className="size-4" aria-hidden />
            <MessageCircle className="size-4" aria-hidden />
          </div>
          <span className="rounded-full bg-[#e8f2ec] px-2.5 py-1 text-xs font-medium text-[#2f6b4f]">
            Publicado
          </span>
        </div>
      </div>
    </div>
  );
}
