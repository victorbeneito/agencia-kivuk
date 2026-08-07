"use client";

import { Download, FileText, TriangleAlert } from "lucide-react";

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
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- el enlace está
            firmado y caduca; el optimizador de Next necesitaría un dominio fijo */}
        <img
          src={url}
          alt="Foto enviada por el contacto"
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

  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 dark:bg-white/10">
      <FileText className="size-5 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nombre}</p>
        <Enlace url={url} nombre={nombre} texto="Descargar" />
      </div>
    </div>
  );
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
      href={url}
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
