import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clienteDelPanel, modulosActivos } from "@/lib/auth";
import { Bandeja } from "@/components/bandeja/bandeja";
import {
  COLUMNAS_CONVERSACION,
  desdeFila,
  type FilaConversacion,
} from "@/components/bandeja/tipos";

export default async function PanelConversacionesPage() {
  const perfil = await clienteDelPanel();

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
    // Dos comportamientos a propósito. En escritorio, altura fija (pantalla
    // menos la cabecera) para que scrollee la lista y no la página, que es lo
    // que se espera de una bandeja de dos columnas. En móvil no se fija nada: la
    // lista scrollea como una página normal —más fluido y sin pelearse con la
    // barra del navegador, que aparece y desaparece— y el hilo, al abrirse, se
    // pone encima a pantalla completa.
    <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100svh-3.5rem)]">
      <Bandeja
        clientId={perfil.clientId}
        conversacionesIniciales={(data ?? []).map(desdeFila)}
      />
    </div>
  );
}
