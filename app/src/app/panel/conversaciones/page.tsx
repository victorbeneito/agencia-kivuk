import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { modulosActivos, requireCliente } from "@/lib/auth";
import { Bandeja } from "@/components/bandeja/bandeja";
import {
  COLUMNAS_CONVERSACION,
  desdeFila,
  type FilaConversacion,
} from "@/components/bandeja/tipos";

export default async function PanelConversacionesPage() {
  const perfil = await requireCliente();

  // La sección no está en la navegación si el módulo no está activo, pero la
  // ruta también lo comprueba: un enlace guardado en favoritos no debería
  // enseñar algo que este cliente no tiene contratado.
  const modulos = await modulosActivos(perfil.clientId);
  if (!modulos.has("whatsapp")) notFound();

  const supabase = await createClient();

  const { data } = await supabase
    .from("conversations")
    .select(COLUMNAS_CONVERSACION)
    .eq("client_id", perfil.clientId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .returns<FilaConversacion[]>();

  return (
    // Altura fija (pantalla menos la cabecera) para que quien haga scroll sea la
    // lista o el hilo, no la página entera: en una bandeja, el compositor tiene
    // que quedarse siempre abajo a la vista.
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col">
      <Bandeja
        clientId={perfil.clientId}
        conversacionesIniciales={(data ?? []).map(desdeFila)}
      />
    </div>
  );
}
