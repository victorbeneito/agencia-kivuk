"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateAgentConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const systemPrompt = formData.get("system_prompt") as string;
  const knowledgeBase = formData.get("knowledge_base") as string;

  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_configs")
    .update({
      system_prompt: systemPrompt,
      knowledge_base: knowledgeBase,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`No se pudo guardar: ${error.message}`);
  }

  revalidatePath(`/dashboard/${clientId}`);
}

export type ModuleName =
  | "whatsapp"
  | "voice"
  | "calendar"
  | "email"
  | "instagram";

export async function toggleModuleActive(
  clientId: string,
  module: ModuleName,
  nextActive: boolean
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("client_modules")
    .upsert(
      { client_id: clientId, module, active: nextActive },
      { onConflict: "client_id,module" }
    );

  if (error) {
    throw new Error(`No se pudo actualizar el módulo: ${error.message}`);
  }

  revalidatePath(`/dashboard/${clientId}`);
}

/**
 * Guarda solo las claves indicadas dentro de `client_modules.config`, dejando
 * intactas las demás. Un módulo puede configurarse desde varios formularios
 * (p. ej. las credenciales de Calendar y el horario de atención): si cada uno
 * escribiera el objeto entero, el último en guardar borraría lo del otro.
 */
async function mergeModuleConfig(
  clientId: string,
  module: ModuleName,
  patch: Record<string, string>
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("client_modules")
    .select("config")
    .eq("client_id", clientId)
    .eq("module", module)
    .maybeSingle();

  const config = {
    ...((existing?.config as Record<string, string> | null) ?? {}),
    ...patch,
  };

  const { error } = await supabase.from("client_modules").upsert(
    { client_id: clientId, module, active: true, config },
    { onConflict: "client_id,module" }
  );

  return error;
}

export async function updateWhatsappConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;

  const error = await mergeModuleConfig(clientId, "whatsapp", {
    phone_number_id: formData.get("phone_number_id") as string,
    whatsapp_business_account_id: formData.get(
      "whatsapp_business_account_id"
    ) as string,
    access_token: formData.get("access_token") as string,
  });

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración de WhatsApp: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}

export async function updateCalendarConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;

  const error = await mergeModuleConfig(clientId, "calendar", {
    calendar_id: formData.get("calendar_id") as string,
    google_client_id: formData.get("google_client_id") as string,
    google_client_secret: formData.get("google_client_secret") as string,
    refresh_token: formData.get("refresh_token") as string,
  });

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración de Calendar: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}

/**
 * Horario de atención del negocio. Lo usa el bot para no ofrecer huecos fuera
 * de horario y para proponer alternativas cuando la hora pedida está ocupada.
 */
export async function updateCalendarSchedule(formData: FormData) {
  const clientId = formData.get("client_id") as string;

  // getAll: los días llegan como una casilla marcada por día (1 = lunes ... 7 = domingo).
  const dias = formData
    .getAll("dias_laborables")
    .map((d) => String(d))
    .filter((d) => /^[1-7]$/.test(d))
    .sort();

  const error = await mergeModuleConfig(clientId, "calendar", {
    dias_laborables: dias.join(","),
    manana_inicio: formData.get("manana_inicio") as string,
    manana_fin: formData.get("manana_fin") as string,
    tarde_inicio: formData.get("tarde_inicio") as string,
    tarde_fin: formData.get("tarde_fin") as string,
    duracion_min: formData.get("duracion_min") as string,
    paso_min: formData.get("paso_min") as string,
  });

  if (error) {
    throw new Error(`No se pudo guardar el horario: ${error.message}`);
  }

  revalidatePath(`/dashboard/${clientId}`);
}

/**
 * Agente de voz (Vapi). El `vapi_assistant_id` es lo que permite que un único
 * webhook de n8n sirva a todos los clientes: al recibir una llamada, se busca
 * qué cliente tiene ese assistant asignado.
 */
export async function updateVoiceConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;

  const error = await mergeModuleConfig(clientId, "voice", {
    vapi_assistant_id: (formData.get("vapi_assistant_id") as string)?.trim() ?? "",
    vapi_phone_number: (formData.get("vapi_phone_number") as string)?.trim() ?? "",
  });

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración del agente de voz: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}

export async function updateEmailConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;

  const error = await mergeModuleConfig(clientId, "email", {
    resend_api_key: formData.get("resend_api_key") as string,
    from_email: formData.get("from_email") as string,
  });

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración de Email: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}
