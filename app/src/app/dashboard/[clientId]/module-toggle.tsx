"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleModuleActive, type ModuleName } from "./actions";

export function ModuleToggle({
  clientId,
  module,
  active,
}: {
  clientId: string;
  module: ModuleName;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={isPending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          await toggleModuleActive(clientId, module, checked);
        });
      }}
    />
  );
}
