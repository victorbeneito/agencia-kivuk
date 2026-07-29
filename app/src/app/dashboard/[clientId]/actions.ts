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

export async function updateWhatsappConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const phoneNumberId = formData.get("phone_number_id") as string;
  const whatsappBusinessAccountId = formData.get(
    "whatsapp_business_account_id"
  ) as string;
  const accessToken = formData.get("access_token") as string;

  const supabase = await createClient();

  const { error } = await supabase.from("client_modules").upsert(
    {
      client_id: clientId,
      module: "whatsapp",
      active: true,
      config: {
        phone_number_id: phoneNumberId,
        whatsapp_business_account_id: whatsappBusinessAccountId,
        access_token: accessToken,
      },
    },
    { onConflict: "client_id,module" }
  );

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración de WhatsApp: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}

export async function updateCalendarConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const calendarId = formData.get("calendar_id") as string;
  const googleClientId = formData.get("google_client_id") as string;
  const googleClientSecret = formData.get("google_client_secret") as string;
  const refreshToken = formData.get("refresh_token") as string;

  const supabase = await createClient();

  const { error } = await supabase.from("client_modules").upsert(
    {
      client_id: clientId,
      module: "calendar",
      active: true,
      config: {
        calendar_id: calendarId,
        google_client_id: googleClientId,
        google_client_secret: googleClientSecret,
        refresh_token: refreshToken,
      },
    },
    { onConflict: "client_id,module" }
  );

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración de Calendar: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}

export async function updateEmailConfig(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const resendApiKey = formData.get("resend_api_key") as string;
  const fromEmail = formData.get("from_email") as string;

  const supabase = await createClient();

  const { error } = await supabase.from("client_modules").upsert(
    {
      client_id: clientId,
      module: "email",
      active: true,
      config: {
        resend_api_key: resendApiKey,
        from_email: fromEmail,
      },
    },
    { onConflict: "client_id,module" }
  );

  if (error) {
    throw new Error(
      `No se pudo guardar la configuración de Email: ${error.message}`
    );
  }

  revalidatePath(`/dashboard/${clientId}`);
}
