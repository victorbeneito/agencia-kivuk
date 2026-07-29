"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createNewClient(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    throw new Error("El nombre del cliente es obligatorio.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_user_id", user?.id ?? "")
    .single();

  if (agencyError || !agency) {
    throw new Error("No se pudo encontrar la agencia del usuario actual.");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({ agency_id: agency.id, name })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error(`No se pudo crear el cliente: ${clientError?.message}`);
  }

  const { error: agentConfigError } = await supabase
    .from("agent_configs")
    .insert({
      client_id: client.id,
      name: "Bot principal",
      system_prompt: "",
      knowledge_base: "",
    });

  if (agentConfigError) {
    throw new Error(
      `Cliente creado, pero no se pudo crear su configuración de bot: ${agentConfigError.message}`
    );
  }

  revalidatePath("/dashboard");
}
