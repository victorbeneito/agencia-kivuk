"use client";

import { Download, ExternalLink, FileText, TriangleAlert } from "lucide-react";

import type { MensajeBandeja } from "./tipos";

/**
 * El archivo que acompaña a un mensaje, dentro de la burbuja.
 *
 * `url` tiene tres estados y los tres se ven distintos:
 *   undefined → todavía se está firmando el enlace
 *   null      → no se pudo firmar (el archivo ya no está, o no hay permiso)
 *   string    → listo
 */
export function Adjunto({
  mensaje,
  url,
}: {
  mensaje: MensajeBandeja;
  url: string | null | undefined;
}) {
  if (!mensaje.mediaPath) return null;

  const tipo = mensaje.mediaType ?? "";
  const nombre = mensaje.mediaName ?? nombrePorTipo(tipo);

  if (url === undefined) {
    return (
      <div className="mb-1.5 h-24 w-56 max-w-full animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
    );
  }

  if (url === null) {
    return (
      <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
        <TriangleAlert className="size-4 shrink-0 opacity-70" />
        <span className="opacity-70">No se puede abrir este archivo.</span>
      </div>
    );
  }

  if (tipo.startsWith("image/")) {
    // La descripción que hizo el bot de la foto ya no sale debajo (se ve la
    // foto), pero se puede leer pasando el ratón por encima.
    const descripcion = (mensaje.contenido ?? "").match(/En la foto se ve:\s*([\s\S]*)$/)?.[1]?.trim();
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- el enlace está
            firmado y caduca; el optimizador de Next necesitaría un dominio fijo */}
        <img
          src={url}
          alt={descripcion || (mensaje.quien === "contact" ? "Foto enviada por el contacto" : "Foto enviada")}
          title={descripcion}
          className="max-h-72 w-auto max-w-full rounded-lg"
        />
      </a>
    );
  }

  if (tipo.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="mb-1.5 max-h-72 w-full max-w-full rounded-lg"
      />
    );
  }

  if (tipo.startsWith("audio/")) {
    return (
      <div className="mb-1.5 flex flex-col gap-1">
        <audio src={url} controls preload="metadata" className="w-full min-w-56" />
        {/*
          Las notas de voz de WhatsApp vienen en Ogg/Opus, que Safari no
          reproduce. En iPhone el reproductor de arriba se queda mudo, así que
          siempre hay una salida: descargarlo y abrirlo fuera.
        */}
        <Enlace url={url} nombre={nombre} texto="Descargar el audio" />
      </div>
    );
  }

  // Un PDF se abre en el visor del navegador, sin descargarlo, como en
  // WhatsApp Web. Word o Excel no tienen visor en el navegador: solo descarga.
  const esPdf = tipo === "application/pdf";

  return (
    <div className="mb-1.5 flex min-w-56 items-center gap-3 rounded-lg bg-black/5 px-3 py-2.5 dark:bg-white/10">
      <FileText className="size-8 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nombre}</p>
        <p className="text-xs opacity-70">{etiquetaTipo(tipo, nombre)}</p>
        <div className="mt-1 flex gap-3">
          {esPdf && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 opacity-90 hover:opacity-100"
            >
              <ExternalLink className="size-3" />
              Abrir
            </a>
          )}
          <Enlace url={url} nombre={nombre} texto="Descargar" />
        </div>
      </div>
    </div>
  );
}

/** «PDF», «Word», «Excel»…: lo que es el archivo, en una palabra. */
function etiquetaTipo(tipo: string, nombre: string) {
  if (tipo === "application/pdf") return "PDF";
  if (/word|\.docx?$/i.test(tipo + nombre)) return "Word";
  if (/excel|spreadsheet|\.xlsx?$/i.test(tipo + nombre)) return "Excel";
  return "Documento";
}

/**
 * El enlace de descarga.
 *
 * El atributo `download` no sirve con un archivo de otro dominio (el de
 * Supabase): el navegador lo ignora y lo abre en una pestaña. Supabase lo
 * descarga de verdad si el enlace firmado lleva `download=<nombre>`.
 */
function conDescarga(url: string, nombre: string) {
  // La vista previa local de lo que se está enviando no es de Supabase.
  if (url.startsWith("blob:")) return url;
  return url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(nombre);
}

function Enlace({
  url,
  nombre,
  texto,
}: {
  url: string;
  nombre: string;
  texto: string;
}) {
  return (
    <a
      href={conDescarga(url, nombre)}
      download={nombre}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
    >
      <Download className="size-3" />
      {texto}
    </a>
  );
}

/** Cuando Meta no manda nombre —todo salvo los documentos— se pone uno legible. */
function nombrePorTipo(tipo: string) {
  if (tipo.startsWith("image/")) return "foto";
  if (tipo.startsWith("video/")) return "video";
  if (tipo.startsWith("audio/")) return "nota-de-voz";
  return "archivo";
}
