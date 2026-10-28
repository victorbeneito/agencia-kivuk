import { ADJUNTOS_PERMITIDOS, tamanoLegible } from "./tipos";

/**
 * Deja un archivo listo para mandarlo por WhatsApp, o explica por qué no se
 * puede.
 *
 * Lo que WhatsApp acepta tal cual pasa sin tocar. Las fotos que no —más de 5 MB,
 * que es lo normal en una foto del móvil, o en un formato que Meta no admite
 * como foto, como WebP— se reducen y se convierten a JPG aquí, en el navegador:
 * para enseñar una muestra a un cliente sobra con 2560 píxeles de lado, y así
 * quien la manda no tiene que saber nada de formatos ni de tamaños.
 */
const LADO_MAXIMO = 2560;
const FOTO_MAXIMA = ADJUNTOS_PERMITIDOS["image/jpeg"].maximo;

export async function prepararArchivo(archivo: File): Promise<File> {
  const permitido = ADJUNTOS_PERMITIDOS[archivo.type];
  if (permitido && archivo.size <= permitido.maximo) return archivo;

  if (archivo.type.startsWith("image/")) return aJpeg(archivo);

  if (!permitido) {
    throw new Error(
      "Ese tipo de archivo no se puede enviar por WhatsApp. Usa una foto, un vídeo MP4 o un PDF."
    );
  }
  throw new Error(
    `Pasa de ${tamanoLegible(permitido.maximo)}, el máximo de WhatsApp para ${
      permitido.clase === "video" ? "un vídeo" : "un documento"
    }.`
  );
}

async function aJpeg(archivo: File): Promise<File> {
  let imagen: ImageBitmap;
  try {
    // Respeta la orientación de la foto (EXIF): sin eso, las fotos verticales
    // del móvil saldrían tumbadas.
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "El navegador no sabe abrir esta foto (pasa con las HEIC del iPhone en el ordenador). Guárdala como JPG y vuelve a probar."
    );
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);

  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la foto.");
  // Fondo blanco: un PNG con transparencia saldría con el fondo negro en JPG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  const nombre = archivo.name.replace(/\.[^.]*$/, "") + ".jpg";
  for (const calidad of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((ok) =>
      lienzo.toBlob(ok, "image/jpeg", calidad)
    );
    if (blob && blob.size <= FOTO_MAXIMA) {
      return new File([blob], nombre, { type: "image/jpeg" });
    }
  }
  throw new Error("La foto es demasiado grande para WhatsApp incluso reducida.");
}
