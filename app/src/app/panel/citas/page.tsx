import { notFound } from "next/navigation";

import { clienteDelPanel, modulosActivos } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  citasEntre,
  citasProximas,
  diasDeLaVista,
  fechaValida,
  trabajadoresDeCalendario,
} from "@/lib/citas";
import {
  CalendarioCitas,
  SelectorDeVista,
  type Vista,
} from "@/components/calendario-citas";
import { CitasLista } from "@/components/citas-lista";
import { cancelarCita } from "./acciones";

/**
 * Las citas, vistas por el negocio.
 *
 * Es la pantalla que cierra el círculo del bot: sin ella, el bot da citas que
 * nadie puede ver.
 *
 * Tres vistas que contestan tres preguntas distintas, y por eso conviven:
 *
 *   - **Lista**: "qué tengo por delante". La de entrada y la que mejor se lee
 *     en el móvil, que es donde se mira esto con prisa.
 *   - **Día**: "a qué me enfrento hoy y quién tiene el hueco de las cinco".
 *   - **Semana**: "cómo vengo de carga". Para esto la rejilla no tiene rival:
 *     lo que se mira no son las citas, es el hueco entre ellas.
 */
export const metadata = { title: "Citas" };

export default async function PanelCitasPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string }>;
}) {
  const perfil = await clienteDelPanel();
  const modulos = await modulosActivos(perfil.clientId);
  if (!modulos.has("calendar")) notFound();

  const { vista: vistaParam, fecha: fechaParam } = await searchParams;
  const vista: Vista | "lista" =
    vistaParam === "dia" || vistaParam === "semana" ? vistaParam : "lista";
  const fecha = fechaValida(fechaParam);

  const supabase = await createClient();
  const base = "/panel/citas";

  if (vista === "lista") {
    const dias = await citasProximas(supabase, perfil.clientId);
    const total = dias.reduce((n, d) => n + d.citas.length, 0);

    return (
      <div className="flex flex-col gap-4 p-4">
        <Cabecera
          base={base}
          vista="lista"
          fecha={fecha}
          subtitulo={
            total
              ? `${total} ${total === 1 ? "cita" : "citas"} en los próximos días.`
              : "Tu agenda de los próximos días."
          }
        />

        <CitasLista
          dias={dias}
          cancelar={cancelarCita}
          vacio="No tienes ninguna cita por delante. Las que reserve el bot por WhatsApp aparecerán aquí solas."
        />
      </div>
    );
  }

  const dias = diasDeLaVista(vista, fecha);
  const [citas, trabajadores] = await Promise.all([
    citasEntre(supabase, perfil.clientId, dias[0], dias[dias.length - 1]),
    trabajadoresDeCalendario(supabase, perfil.clientId),
  ]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Cabecera
        base={base}
        vista={vista}
        fecha={fecha}
        subtitulo={
          citas.length
            ? `${citas.length} ${citas.length === 1 ? "cita" : "citas"} en ${vista === "dia" ? "el día" : "la semana"}.`
            : `Sin citas en ${vista === "dia" ? "este día" : "esta semana"}.`
        }
      />

      <CalendarioCitas
        vista={vista}
        fecha={fecha}
        citas={citas}
        trabajadores={trabajadores}
        base={base}
      />
    </div>
  );
}

function Cabecera({
  base,
  vista,
  fecha,
  subtitulo,
}: {
  base: string;
  vista: Vista | "lista";
  fecha: string;
  subtitulo: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 className="text-xl font-semibold">Citas</h1>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      <SelectorDeVista base={base} vista={vista} fecha={fecha} />
    </header>
  );
}
