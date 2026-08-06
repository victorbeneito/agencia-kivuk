"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salirDeLaVista } from "@/app/dashboard/[clientId]/vista";

export function SalirDeLaVista() {
  const [pendiente, empezar] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pendiente}
      onClick={() => empezar(() => salirDeLaVista())}
    >
      <LogOut className="size-4" />
      Volver a mi panel
    </Button>
  );
}
