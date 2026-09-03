import type { MetadataRoute } from "next";
import { KIVUK } from "@/lib/web/kivuk";

/**
 * El panel y el login quedan fuera del índice: no aportan nada en una búsqueda
 * y aparecer ahí solo invita a que alguien pruebe contraseñas.
 *
 * Vive en la raíz de `app/` y no dentro del grupo `(web)` como el sitemap: ahí
 * dentro Next no lo recoge y `/robots.txt` sale 404 sin avisar de nada.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/panel/", "/login", "/api/", "/entrar"],
    },
    sitemap: `${KIVUK.web}/sitemap.xml`,
  };
}
