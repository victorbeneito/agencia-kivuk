"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Los emojis de siempre, a un clic.
 *
 * En el móvil el teclado ya los trae, pero en el ordenador no: quien atiende
 * desde el PC no tenía forma de poner un 😊 o un 🙏, y una respuesta sin ellos
 * suena más seca que lo que el negocio escribe en su WhatsApp de siempre
 * (Cestería, 06/11/2026). No es el catálogo entero de emojis —para eso está el
 * teclado del móvil—, sino los que se usan atendiendo a clientes de una tienda.
 */
const EMOJIS = [
  "😊", "🙂", "😀", "😁", "😉", "😍", "🥰", "🤗",
  "😅", "😂", "😔", "😢", "😮", "🤔", "🙏", "👍",
  "👌", "👏", "🙌", "💪", "✌️", "🤞", "👋", "❤️",
  "🧡", "💛", "💚", "🤍", "🌿", "🌸", "🌻", "☀️",
  "✨", "⭐", "🎉", "🎁", "🎄", "🛍️", "📦", "🚚",
  "📸", "📞", "✉️", "📅", "⏰", "✅", "❌", "⚠️",
];

export function SelectorEmojis({
  onElegir,
  disabled,
}: {
  onElegir: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  // Se cierra al pulsar fuera o con Escape, como cualquier menú.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!cajaRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div ref={cajaRef} className="relative shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        aria-label="Poner un emoji"
        aria-expanded={abierto}
        title="Emojis"
        disabled={disabled}
        // Sin esto, pulsar el botón le quita el foco al cuadro de texto y el
        // emoji ya no sabe dónde estaba el cursor.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setAbierto((a) => !a)}
      >
        <Smile className="size-5" />
      </Button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Emojis"
          className="absolute bottom-full left-0 z-20 mb-2 grid w-72 grid-cols-8 gap-0.5 rounded-xl border bg-popover p-2 shadow-lg"
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex size-8 items-center justify-center rounded-md text-xl hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              // Se queda abierto: lo normal es poner dos o tres seguidos.
              onClick={() => onElegir(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
