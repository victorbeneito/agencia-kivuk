import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
