import type { Metadata } from "next";
import { Cabecera } from "@/components/web/cabecera";
import { Pie } from "@/components/web/pie";
import { KIVUK } from "@/lib/web/kivuk";

/**
 * La web pública de la agencia.
 *
 * Comparte código, paleta y tipografía con el panel a propósito: quien contrata
 * después entra en `/panel` y se encuentra la misma casa. El grupo de rutas
 * `(web)` no aparece en la URL — solo sirve para que estas páginas tengan
 * cabecera y pie propios sin heredar nada del panel.
 *
 * El mismo despliegue responde en `agenciakivuk.com` (la web) y en
 * `panel.agenciakivuk.com` (el panel). Por eso `metadataBase` y el canónico
 * apuntan siempre al dominio principal: si Google encontrara la landing por el
 * subdominio del panel, competiría consigo misma.
 */
export const metadata: Metadata = {
  metadataBase: new URL(KIVUK.web),
  title: {
    default: "Kivuk Agencia — Tu WhatsApp contestado a todas horas",
    template: "%s · Kivuk Agencia",
  },
  description:
    "Montamos un asistente con IA sobre el WhatsApp de tu negocio: responde por tu catálogo, agenda citas y te avisa cuando alguien quiere hablar con una persona.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: KIVUK.nombre,
    url: KIVUK.web,
    title: "Tu WhatsApp contestado a todas horas",
    description:
      "Asistentes con IA para comercio local: WhatsApp atendido, citas en el calendario y redes al día. Con panel propio para tomar el mando cuando quieras.",
  },
  robots: { index: true, follow: true },
};

export default function WebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Cabecera />
      <main className="flex-1">{children}</main>
      <Pie />
    </>
  );
}
