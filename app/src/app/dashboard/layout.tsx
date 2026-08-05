import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El middleware ya reparte por rol, pero aquí se vuelve a exigir: una
  // redirección se puede saltar de muchas maneras, una comprobación en el
  // servidor no.
  const user = await requireAgencia();
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("name")
    .eq("owner_user_id", user.userId)
    .single();

  return (
    <SidebarProvider>
      <AppSidebar agencyName={agency?.name ?? "Agencia"} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="font-heading text-sm font-semibold">
              Panel de la agencia
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
