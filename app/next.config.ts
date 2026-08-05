import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta el servidor con solo las dependencias que usa, en vez de arrastrar
  // node_modules entero. Es lo que permite que la imagen de Docker del panel
  // pese decenas de MB y no cientos. Sin efecto en `npm run dev`.
  output: "standalone",
  images: {
    // Las piezas generadas se sirven desde el bucket público de Supabase
    // Storage. Sin declarar el host aquí, next/image devuelve 400 y en la
    // pantalla de contenido no se ve ninguna imagen.
    //
    // El host se saca de SUPABASE_URL en vez de escribirlo a mano: cada
    // instalación de la plataforma apunta a su propio proyecto de Supabase.
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    // Las Server Actions aceptan 1 MB por defecto y una pieza de Instagram
    // exportada de una herramienta de diseño pasa de eso sin despeinarse. El
    // servicio de imagen corta en 12 MB, así que aquí se pone lo mismo: mejor
    // que el límite salte donde puede explicarse.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
