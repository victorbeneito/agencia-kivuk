"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Selector de emojis para quien atiende desde el ordenador.
 *
 * En el móvil el teclado ya trae todos, así que el botón solo sale en pantallas
 * grandes. En el PC no había forma de poner ni un 😊 (Cestería, 06/11/2026), y
 * la primera versión, con 48, se quedó corta comparada con WhatsApp.
 *
 * Sin librería: son listas de texto, por categorías, como en WhatsApp. Solo
 * emojis hasta la versión 12 de Unicode, que son los que Windows 10 sabe
 * pintar; los más nuevos salen como un cuadrado vacío en esos ordenadores. Las
 * banderas tampoco: Windows las enseña como dos letras.
 */
const CATEGORIAS: { nombre: string; icono: string; emojis: string }[] = [
  {
    nombre: "Caras",
    icono: "😊",
    emojis:
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊",
  },
  {
    nombre: "Gestos y personas",
    icono: "👍",
    emojis:
      "👋 🤚 🖐️ ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 💋 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙋 🙇 🤦 🤷 💁 🙆 🙅 👮 👷 🤰 🤱 👼 🎅 🤶 💃 🕺 👯 🚶 🏃 👫 👭 👬 👪",
  },
  {
    nombre: "Corazones y símbolos",
    icono: "❤️",
    emojis:
      "❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ✖️ ❗ ❓ ❕ ❔ ‼️ ⁉️ ⚠️ 🚫 ⛔ 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🔶 🔷 🔸 🔹 ⭐ 🌟 ✨ ⚡ 🔥 💯 💢 💥 💫 💦 💨 🆕 🆗 🆓 ℹ️ 🔝 🔜 ▶️ ⏸️ 🔔 🔕 💤 💬 💭 ♻️ ☮️ 🎵 🎶 ➡️ ⬅️ ⬆️ ⬇️ 🔄",
  },
  {
    nombre: "Naturaleza",
    icono: "🌿",
    emojis:
      "🌿 🍃 🍂 🍁 🌱 🌲 🌳 🌴 🌵 🌾 ☘️ 🍀 🌷 🌹 🥀 🌺 🌸 🌼 🌻 💐 🌞 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ ❄️ ☃️ ⛄ 🌈 🌙 🌊 💧 ☔ 🌍 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐬 🐳 🦀",
  },
  {
    nombre: "Comida y bebida",
    icono: "🍓",
    emojis:
      "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🥐 🥖 🍞 🥨 🧀 🥚 🍳 🥞 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🥘 🍝 🍜 🍲 🍛 🍣 🍤 🍚 🍰 🎂 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍩 🍪 🌰 🥜 ☕ 🍵 🧃 🥤 🍺 🍻 🥂 🍷 🍸 🍹 🍾 🧊",
  },
  {
    nombre: "Celebraciones",
    icono: "🎉",
    emojis:
      "🎉 🎊 🎈 🎁 🎀 🎂 🎄 🎃 🎆 🎇 🧨 🎗️ 🏆 🥇 🥈 🥉 🏅 🎖️ 💍 💐 🕯️ ⚽ 🏀 🎾 🏐 🏓 🎯 🎳 🎮 🎲 🧩 🎨 🎭 🎤 🎧 🎼 🎹 🎸 🎻 🎬 📷 📸 🏖️ 🏝️ 🏕️ ⛱️ 🎡 🎢",
  },
  {
    nombre: "Objetos y viajes",
    icono: "📦",
    emojis:
      "📦 🛍️ 🛒 🧺 🛋️ 🛏️ 🚪 🖼️ 💡 🔦 🏠 🏡 🏢 🏬 🏭 🏪 ⛪ 🚚 🚛 🚐 🚗 🚕 🚌 🚲 🛵 ✈️ 🚢 ⛵ 🚂 📍 🗺️ 🧭 ⏰ ⌚ ⏳ ⌛ 📅 📆 🗓️ 📞 ☎️ 📱 💻 🖥️ 🖨️ ⌨️ 💾 📧 ✉️ 📩 📨 📮 📝 ✏️ 🖊️ 📌 📎 ✂️ 📏 📐 🔑 🔒 🔓 💳 💶 💰 🧾 📄 📃 📑 📊 📈 📉 🏷️ 🔖 🧵 🧶 👜 👛 🎒 👒 🎩 🧢 👓 🕶️ 👗 👕 👖 🧣 🧤 🧥 🧦 👠 👡 👢 👞 👟",
  },
];

const CLAVE_RECIENTES = "kivuk-emojis-recientes";
const MAXIMO_RECIENTES = 24;

function leerRecientes(): string[] {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || "[]");
    return Array.isArray(guardados) ? guardados.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

export function SelectorEmojis({
  onElegir,
  disabled,
}: {
  onElegir: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [recientes, setRecientes] = useState<string[]>([]);
  /** -1 son los recientes; el resto, el índice de la categoría. */
  const [pestana, setPestana] = useState(0);
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

  function abrir() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    // Los recientes se leen al abrir: así salen los que se usaron en otra
    // conversación, y si el navegador no deja guardar nada, no pasa nada.
    const guardados = leerRecientes();
    setRecientes(guardados);
    setPestana(guardados.length ? -1 : 0);
    setAbierto(true);
  }

  function elegir(emoji: string) {
    onElegir(emoji);
    const siguientes = [emoji, ...recientes.filter((e) => e !== emoji)].slice(0, MAXIMO_RECIENTES);
    setRecientes(siguientes);
    try {
      localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(siguientes));
    } catch {
      // Sin almacenamiento (ventana privada), los recientes duran lo que el panel abierto.
    }
  }

  const lista =
    pestana === -1 ? recientes : CATEGORIAS[pestana].emojis.split(" ").filter(Boolean);

  return (
    // En el móvil no hace falta: el teclado ya trae los emojis.
    <div ref={cajaRef} className="relative hidden shrink-0 md:block">
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
        onClick={abrir}
      >
        <Smile className="size-5" />
      </Button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Emojis"
          className="absolute bottom-full left-0 z-20 mb-2 flex w-[22rem] flex-col rounded-xl border bg-popover shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex gap-0.5 border-b p-1.5">
            {recientes.length > 0 && (
              <Pestana activa={pestana === -1} titulo="Recientes" onClick={() => setPestana(-1)}>
                🕘
              </Pestana>
            )}
            {CATEGORIAS.map((c, i) => (
              <Pestana key={c.nombre} activa={pestana === i} titulo={c.nombre} onClick={() => setPestana(i)}>
                {c.icono}
              </Pestana>
            ))}
          </div>
          <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
            {pestana === -1 ? "Recientes" : CATEGORIAS[pestana].nombre}
          </p>
          <div className="grid h-64 grid-cols-9 content-start gap-0.5 overflow-y-auto p-2">
            {lista.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex size-9 items-center justify-center rounded-md text-2xl hover:bg-accent"
                // Se queda abierto: lo normal es poner dos o tres seguidos.
                onClick={() => elegir(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Pestana({
  activa,
  titulo,
  onClick,
  children,
}: {
  activa: boolean;
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-md text-lg hover:bg-accent",
        activa && "bg-accent"
      )}
    >
      {children}
    </button>
  );
}
