"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Images,
  MessageSquare,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Navegación del panel del cliente.
 *
 * La lista no es fija: se construye con los módulos que ese cliente tiene
 * activos. Un cliente sin redes no ve «Contenido» — ni el enlace, ni la página,
 * porque la ruta también lo comprueba. Enseñar secciones vacías de servicios que
 * no ha contratado sería, en el mejor de los casos, ruido.
 */
export type SeccionPanel = {
  titulo: string;
  url: string;
  icono: LucideIcon;
  exacto?: boolean;
  /** Pendientes de mirar: mensajes sin leer, piezas por aprobar. */
  aviso?: number;
};

const ICONOS: Record<string, LucideIcon> = {
  inicio: Home,
  conversaciones: MessageSquare,
  contenido: Images,
  cuenta: UserRound,
};

export function PanelSidebar({
  nombreCliente,
  secciones,
}: {
  nombreCliente: string;
  secciones: { clave: string; titulo: string; url: string; exacto?: boolean; aviso?: number }[];
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-1 px-2 py-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <Image
            src="/kivuk-logo.png"
            alt="Kivuk Agencia"
            width={800}
            height={407}
            priority
            className="h-[72px] w-auto max-w-[170px] object-contain object-left group-data-[collapsible=icon]:hidden"
          />
          <Image
            src="/kivuk-marca.png"
            alt="Kivuk"
            width={256}
            height={361}
            className="hidden h-[22px] w-auto group-data-[collapsible=icon]:block"
          />
          <span className="truncate text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            {nombreCliente}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secciones.map((s) => {
                const Icono = ICONOS[s.clave] ?? Home;
                const activa = s.exacto
                  ? pathname === s.url
                  : pathname.startsWith(s.url);

                return (
                  <SidebarMenuItem key={s.url}>
                    <SidebarMenuButton
                      isActive={activa}
                      tooltip={s.titulo}
                      render={<Link href={s.url} />}
                    >
                      <Icono />
                      <span>{s.titulo}</span>
                    </SidebarMenuButton>
                    {s.aviso ? (
                      <SidebarMenuBadge className="bg-[var(--kivuk-terracota)] text-white">
                        {s.aviso}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <span className="px-2 py-1 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          Kivuk Agencia
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
