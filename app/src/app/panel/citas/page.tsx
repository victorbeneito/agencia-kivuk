import { notFound } from "next/navigation";

import { clienteDelPanel, modulosActivos } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { citasProximas } from "@/lib/citas";
import { CitasLista } from "@/components/citas-lista";
import { cancelarCita } from "./acciones";

/**
 * Las citas, vistas por el negocio.
 *
 * Es la pantalla que cierra el círculo del bot: sin ella, el bot da citas que
 * nadie puede ver. Se abre en el día de hoy porque la pregunta que trae aquí
 * casi siempre es "¿qué me queda esta tarde?".
 *
 * No se paginan ni se filtran los próximos 30 días: un salón de tres personas
 * llena una pantalla de móvil con dos días, y cualquier filtro sería un botón
 * más que tocar para llegar a lo que ya estaba a la vista.
 */
export const metadata = { title: "Citas" };

export default async function PanelCitasPage() {
  const perfil = await clienteDelPanel();
  const modulos = await modulosActivos(perfil.clientId);
  if (!modulos.has("calendar")) notFound();

  const supabase = await createClient();
  const dias = await citasProximas(supabase, perfil.clientId);

  const total = dias.reduce((n, d) => n + d.citas.length, 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Citas</h1>
        <p className="text-sm text-muted-foreground">
          {total
            ? `${total} ${total === 1 ? "cita" : "citas"} en los próximos días.`
            : "Tu agenda de los próximos días."}
        </p>
      </header>

      <CitasLista
        dias={dias}
        cancelar={cancelarCita}
        vacio="No tienes ninguna cita por delante. Las que reserve el bot por WhatsApp aparecerán aquí solas."
      />
    </div>
  );
}
