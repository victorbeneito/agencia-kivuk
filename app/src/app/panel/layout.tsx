import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { modulosActivos, requireCliente } from "@/lib/auth";
import { PanelSidebar } from "@/components/panel-sidebar";
import { LogoutButton } from "@/components/logout-button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

/**
 * Panel del cliente final.
 *
 * Vive en su propio segmento de primer nivel, no colgando de `/dashboard`, por
 * dos motivos: el rol se comprueba una sola vez para todo el árbol, y cuando
 * llegue la PWA el `scope` del service worker será limpio (`/panel`) sin
 * arrastrar el panel de la agencia.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireCliente();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clients")
    .select("name")
    .eq("id", perfil.clientId)
    .single();

  const modulos = await modulosActivos(perfil.clientId);

  // Los avisos que llevan a mirar el panel: mensajes sin leer y piezas que
  // esperan un sí o un no. Se cuentan aquí para que salgan en la barra estés
  // donde estés.
  const [{ data: conversaciones }, { count: porRevisar }] = await Promise.all([
    modulos.has("whatsapp")
      ? supabase
          .from("conversations")
          .select("unread_count")
          .eq("client_id", perfil.clientId)
      : Promise.resolve({ data: [] as { unread_count: number }[] }),
    modulos.has("social")
      ? supabase
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("client_id", perfil.clientId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const sinLeer = (conversaciones ?? []).reduce(
    (total, c) => total + (c.unread_count ?? 0),
    0
  );

  const secciones = [
    { clave: "inicio", titulo: "Inicio", url: "/panel", exacto: true },
    ...(modulos.has("whatsapp")
      ? [
          {
            clave: "conversaciones",
            titulo: "Conversaciones",
            url: "/panel/conversaciones",
            aviso: sinLeer,
          },
        ]
      : []),
    ...(modulos.has("social")
      ? [
          {
            clave: "contenido",
            titulo: "Contenido",
            url: "/panel/contenido",
            aviso: porRevisar ?? 0,
          },
        ]
      : []),
  ];

  return (
    <SidebarProvider>
      <PanelSidebar
        nombreCliente={cliente?.name ?? "Tu negocio"}
        secciones={secciones}
      />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="font-heading text-sm font-semibold">
              {cliente?.name ?? "Tu negocio"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* El email lleva a la cuenta: es donde lo busca todo el mundo, y
                evita gastar un hueco de la navegación en algo que se toca una
                vez (cambiar la contraseña temporal que le dimos). */}
            <Link
              href="/panel/cuenta"
              className="hidden text-sm text-muted-foreground hover:text-foreground hover:underline sm:block"
            >
              {perfil.email}
            </Link>
            <LogoutButton />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
