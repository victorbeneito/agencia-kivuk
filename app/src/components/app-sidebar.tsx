"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Images,
  MessageSquare,
  Mic,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Navegación agrupada por para qué sirve cada cosa, no por en qué tabla vive.
 * "Día a día" es lo que se abre cada mañana; "Ajustes" lo que se toca una vez.
 */
type ItemNav = {
  titulo: string;
  url: string;
  icon: LucideIcon;
  /** Solo se marca activo en su ruta exacta, no en las subrutas. */
  exacto?: boolean;
};

const GRUPOS: { titulo: string; items: ItemNav[] }[] = [
  {
    titulo: "Panel",
    items: [{ titulo: "Clientes", url: "/dashboard", icon: Users, exacto: true }],
  },
  {
    titulo: "Día a día",
    items: [
      { titulo: "Conversaciones", url: "/dashboard/conversaciones", icon: MessageSquare },
    ],
  },
  {
    titulo: "Ajustes",
    items: [
      { titulo: "Configuración de la agencia", url: "/dashboard/configuracion", icon: Settings },
    ],
  },
];

/** Se enseñan siempre, aunque aún no tengan pantalla propia de agencia. */
const MODULOS = [
  { titulo: "WhatsApp", icon: MessageSquare },
  { titulo: "Agente de voz", icon: Mic },
  { titulo: "Agenda", icon: CalendarClock },
  { titulo: "Redes sociales", icon: Images },
];

export function AppSidebar({ agencyName }: { agencyName: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        {/*
          El logotipo original viene en JPG sobre blanco, que sobre la barra
          oscura sería un rectángulo blanco. Los PNG de `public/` son el mismo
          logotipo con el fondo eliminado y recortado; la marca suelta (la K) es
          para cuando la barra está plegada y no cabe el logotipo entero.
        */}
        <div className="flex flex-col gap-1 px-2 py-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <Image
            src="/kivuk-logo.png"
            alt="Kivuk Agencia"
            width={800}
            height={407}
            priority
            className="h-[38px] w-auto max-w-[170px] object-contain object-left group-data-[collapsible=icon]:hidden"
          />
          <Image
            src="/kivuk-marca.png"
            alt="Kivuk"
            width={256}
            height={361}
            className="hidden h-[22px] w-auto group-data-[collapsible=icon]:block"
          />
          <span className="truncate text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            {agencyName}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GRUPOS.map((grupo) => (
          <SidebarGroup key={grupo.titulo}>
            <SidebarGroupLabel>{grupo.titulo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.items.map((item) => {
                  const activa = item.exacto
                    ? pathname === item.url
                    : pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={activa}
                        tooltip={item.titulo}
                        render={<Link href={item.url} />}
                      >
                        <item.icon />
                        <span>{item.titulo}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MODULOS.map((m) => (
                <SidebarMenuItem key={m.titulo}>
                  <SidebarMenuButton
                    tooltip={`${m.titulo} — se activa por cliente`}
                    className="cursor-default opacity-55"
                  >
                    <m.icon />
                    <span>{m.titulo}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
