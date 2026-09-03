import type { MetadataRoute } from "next";
import { KIVUK } from "@/lib/web/kivuk";

/**
 * Solo las páginas públicas. El panel, el login y las API no entran: no hay
 * nada que indexar detrás de una contraseña.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  return [
    { url: KIVUK.web, lastModified: ahora, changeFrequency: "monthly", priority: 1 },
    { url: `${KIVUK.web}/aviso-legal`, lastModified: ahora, priority: 0.2 },
    { url: `${KIVUK.web}/privacidad`, lastModified: ahora, priority: 0.2 },
  ];
}
