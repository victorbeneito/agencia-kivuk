import { Check, CheckCheck } from "lucide-react";

/**
 * La conversación de ejemplo del hero.
 *
 * Es la pieza que más trabaja de toda la web: a un comerciante se le puede
 * explicar veinte veces qué es «un asistente con IA» y se queda igual, pero ve
 * una consulta contestada a las 23:41 y entiende el producto entero. Va en HTML
 * y CSS, no en una captura: pesa nada, se lee en cualquier tamaño y se puede
 * cambiar el texto sin abrir un editor de imágenes.
 *
 * Los colores son los de WhatsApp a propósito —es el único sitio de la web
 * donde no manda la paleta de Kivuk—: el reconocimiento instantáneo es justo lo
 * que hace que la imagen funcione.
 */

type Mensaje = {
  de: "cliente" | "bot";
  texto: string;
  hora: string;
};

const CONVERSACION: Mensaje[] = [
  {
    de: "cliente",
    texto: "Buenas! ¿Tenéis la cesta de mimbre que sale en la foto de ayer?",
    hora: "23:41",
  },
  {
    de: "bot",
    texto:
      "¡Hola! Sí, es la cesta Provenza. La tenemos en 45 cm por 38 € y en 60 cm por 52 €. Las dos están hechas a mano aquí.",
    hora: "23:41",
  },
  { de: "cliente", texto: "Genial. ¿Puedo pasar mañana a verla?", hora: "23:42" },
  {
    de: "bot",
    texto:
      "Claro. Mañana abrimos de 10:00 a 14:00 y de 17:00 a 20:30. ¿Te la guardo a tu nombre?",
    hora: "23:42",
  },
  { de: "cliente", texto: "Sí, a nombre de Marta 🙂", hora: "23:43" },
  {
    de: "bot",
    texto: "Hecho, Marta. Te la reservo hasta mañana a las 20:30. ¡Hasta luego!",
    hora: "23:43",
  },
];

export function ChatDemo() {
  return (
    <div className="w-full max-w-sm">
      <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_24px_60px_-20px_rgba(43,63,77,0.45)]">
        {/* Cabecera del chat */}
        <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            CA
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              Cestería artesanal
            </p>
            <p className="text-[11px] text-white/70">en línea</p>
          </div>
        </div>

        {/* Hilo */}
        <div className="space-y-2 bg-[#efeae2] px-3 py-4">
          <p className="mx-auto w-fit rounded-md bg-white/70 px-2.5 py-1 text-[11px] text-[#54656f] shadow-sm">
            Martes, 23:41
          </p>

          {CONVERSACION.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.de === "bot" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-[#111b21] shadow-sm ${
                  m.de === "bot" ? "bg-[#d9fdd3]" : "bg-white"
                }`}
              >
                <p>{m.texto}</p>
                <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                  {m.hora}
                  {m.de === "bot" ? (
                    <CheckCheck className="size-3 text-[#53bdeb]" aria-hidden />
                  ) : (
                    <Check className="size-3" aria-hidden />
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        Conversación de ejemplo. En tu negocio responde con tu catálogo, tus
        precios y tus horarios reales.
      </p>
    </div>
  );
}
