import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "./logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agency } = await supabase
    .from("agencies")
    .select("name")
    .eq("owner_user_id", user?.id ?? "")
    .single();

  return (
    <SidebarProvider>
      <AppSidebar agencyName={agency?.name ?? "Agencia"} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              {agency?.name ?? "Agencia"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <LogoutButton />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
