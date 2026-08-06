import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";

// Poppins es la tipografía del logotipo de Kivuk: usarla en el panel hace que
// la marca y la herramienta parezcan la misma cosa.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kivuk Agencia",
    template: "%s · Kivuk",
  },
  description:
    "Plataforma de automatización con IA para agencias: WhatsApp, voz, agenda y redes sociales.",
};

/**
 * Next ya pone el viewport por defecto, pero aquí hacen falta dos cosas más:
 *
 * - `viewportFit: "cover"` para que la app llegue a los bordes de la pantalla en
 *   los móviles con notch. Sin esto, instalada en el iPhone, queda una franja
 *   blanca arriba y abajo.
 * - `maximumScale` sin tocar (se deja el valor por defecto) a propósito: fijarlo
 *   a 1 impide hacer zoom con los dedos, que es lo primero que necesita alguien
 *   con poca vista. Los teclados que hacen zoom solos se evitan con tamaños de
 *   letra de 16px en los campos, no prohibiendo el zoom.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2b3f4d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
