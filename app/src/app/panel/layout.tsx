import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clienteDelPanel, modulosActivos } from "@/lib/auth";
import { PanelSidebar } from "@/components/panel-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { SalirDeLaVista } from "@/components/salir-de-la-vista";
import { AvisosEnPanel } from "@/components/avisos-en-panel";
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
  const contexto = await clienteDelPanel();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clients")
    .select("name")
    .eq("id", contexto.clientId)
    .single();

  const modulos = await modulosActivos(contexto.clientId);

  const { data: avisos } = await supabase
    .from("client_notification_settings")
    .select("en_panel")
    .eq("client_id", contexto.clientId)
    .maybeSingle();

  // Los avisos que llevan a mirar el panel: mensajes sin leer y piezas que
  // esperan un sí o un no. Se cuentan aquí para que salgan en la barra estés
  // donde estés.
  const [{ data: conversaciones }, { count: porRevisar }] = await Promise.all([
    modulos.has("whatsapp")
      ? supabase
          .from("conversations")
          .select("unread_count, handoff_requested_at, mode, last_inbound_at")
          .eq("client_id", contexto.clientId)
      : Promise.resolve({
          data: [] as {
            unread_count: number;
            handoff_requested_at: string | null;
            mode: string;
            last_inbound_at: string | null;
          }[],
        }),
    modulos.has("social")
      ? supabase
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("client_id", contexto.clientId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const sinLeer = (conversaciones ?? []).reduce(
    (total, c) => total + (c.unread_count ?? 0),
    0
  );

  // Las que ya estaban esperando a una persona al cargar. Es la foto de partida
  // del avisador: sin ella no sabría distinguir «esto ya estaba» de «esto acaba
  // de pasar».
  const esperando = (conversaciones ?? []).filter(
    (c) => c.handoff_requested_at && c.mode !== "human"
  ).length;

  const ultimoEntrante = (conversaciones ?? []).reduce(
    (max, c) =>
      c.last_inbound_at && c.last_inbound_at > max ? c.last_inbound_at : max,
    ""
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
    // Cambiar la contraseña temporal es lo primero que hará quien reciba un
    // acceso, así que tiene que estar escrito en algún sitio. Estaba solo
    // detrás del email de la cabecera y no se le ocurre a nadie pulsarlo.
    //
    // También en la vista de agencia: ahí no sale el cambio de contraseña
    // (sería la del administrador), pero sí los avisos, que muchas veces se
    // dejan configurados al dar de alta al cliente.
    { clave: "cuenta", titulo: "Tu cuenta", url: "/panel/cuenta" },
  ];

  const nombre = cliente?.name ?? "Tu negocio";

  return (
    <SidebarProvider>
      {/* No pinta nada: pone el contador en el título de la pestaña y suena
          cuando llega algo nuevo. En la vista de agencia también, que para eso
          se entra a comprobar si el aviso funciona. */}
      {modulos.has("whatsapp") && (
        <AvisosEnPanel
          clientId={contexto.clientId}
          activo={avisos?.en_panel ?? true}
          sinLeerInicial={sinLeer}
          esperandoInicial={esperando}
          ultimoEntranteInicial={ultimoEntrante}
          tituloBase={nombre}
        />
      )}

      <PanelSidebar nombreCliente={nombre} secciones={secciones} />
      <SidebarInset>
        {contexto.esVistaDeAgencia && (
          // Una barra que no se puede pasar por alto: sin ella es fácil creer
          // que estás en tu panel y no entender por qué solo ves un cliente.
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--kivuk-terracota)] px-4 py-2 text-sm text-white">
            <span>
              Estás viendo el panel de{" "}
              <strong>{cliente?.name ?? "este cliente"}</strong> como lo ve él.
            </span>
            <SalirDeLaVista />
          </div>
        )}

        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="font-heading text-sm font-semibold">
              {nombre}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {contexto.esVistaDeAgencia ? (
              <span className="hidden text-sm text-muted-foreground sm:block">
                {contexto.email} (agencia)
              </span>
            ) : (
              <Link
                href="/panel/cuenta"
                className="hidden text-sm text-muted-foreground hover:text-foreground hover:underline sm:block"
              >
                {contexto.email}
              </Link>
            )}
            {!contexto.esVistaDeAgencia && <LogoutButton />}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
