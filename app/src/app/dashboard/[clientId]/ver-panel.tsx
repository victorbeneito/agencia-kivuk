"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verComoCliente } from "./vista";

export function VerPanelDelCliente({ clientId }: { clientId: string }) {
  const [pendiente, empezar] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pendiente}
      onClick={() => empezar(() => verComoCliente(clientId))}
    >
      <Eye className="size-4" />
      Ver su panel
    </Button>
  );
}
