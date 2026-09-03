import { ImageResponse } from "next/og";

/**
 * La tarjeta que se ve al pegar el enlace de la web en WhatsApp, en LinkedIn o
 * en un mensaje de prospección.
 *
 * Importa más de lo que parece: casi todo el tráfico de la agencia va a llegar
 * de un enlace pegado a mano en una conversación, y un enlace sin tarjeta
 * parece spam. Se genera con `next/og` en vez de con una imagen fija para que
 * cambiar el texto no obligue a abrir un editor.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Kivuk Agencia — asistentes con IA para el WhatsApp de tu negocio";

export default function Imagen() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#2b3f4d",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 44,
              borderRadius: 999,
              background: "#8eb9c5",
            }}
          />
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: 6,
            }}
          >
            KIVUK
          </span>
          <span style={{ fontSize: 26, color: "#d0bc82" }}>agencia</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Tu negocio contesta a todas horas. Tú, solo cuando quieras.
          </span>
          <span style={{ fontSize: 30, color: "#b9c6cf", maxWidth: 880 }}>
            Asistentes con IA para el WhatsApp de tu negocio: responden por tu
            catálogo, agendan citas y te avisan cuando toca una persona.
          </span>
        </div>

        <span style={{ fontSize: 26, color: "#8eb9c5" }}>agenciakivuk.com</span>
      </div>
    ),
    size
  );
}
