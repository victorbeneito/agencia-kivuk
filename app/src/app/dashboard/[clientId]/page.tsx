import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  updateAgentConfig,
  updateCalendarConfig,
  updateEmailConfig,
  updateWhatsappConfig,
  type ModuleName,
} from "./actions";
import { ModuleToggle } from "./module-toggle";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MODULE_LABELS: Record<ModuleName, string> = {
  whatsapp: "WhatsApp",
  voice: "Agente de voz",
  calendar: "Agenda / Calendar",
  email: "Automatización de correos",
  instagram: "Instagram",
};

const MODULE_ORDER: ModuleName[] = [
  "whatsapp",
  "voice",
  "calendar",
  "email",
  "instagram",
];

export default async function ClientBotPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  const { data: agentConfig, error } = await supabase
    .from("agent_configs")
    .select("system_prompt, knowledge_base")
    .eq("client_id", clientId)
    .single();

  const { data: modules } = await supabase
    .from("client_modules")
    .select("module, active, config")
    .eq("client_id", clientId);

  const moduleByName = new Map(
    (modules ?? []).map((m) => [m.module as ModuleName, m])
  );

  const whatsappConfig =
    (moduleByName.get("whatsapp")?.config as Record<string, string> | null) ??
    {};
  const calendarConfig =
    (moduleByName.get("calendar")?.config as Record<string, string> | null) ??
    {};
  const emailConfig =
    (moduleByName.get("email")?.config as Record<string, string> | null) ??
    {};

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a clientes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{client?.name ?? "Cliente"}</CardTitle>
          <CardDescription>Módulos activos para este cliente</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/${clientId}/conversaciones`} />}
            >
              Ver conversaciones
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {MODULE_ORDER.map((module) => (
            <div
              key={module}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="text-sm font-medium">
                {MODULE_LABELS[module]}
              </span>
              <ModuleToggle
                clientId={clientId}
                module={module}
                active={moduleByName.get(module)?.active ?? false}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciales de WhatsApp</CardTitle>
          <CardDescription>
            Datos de Meta Cloud API para el número de este cliente.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(whatsappConfig)} action={updateWhatsappConfig}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone_number_id">Phone Number ID</Label>
              <Input
                id="phone_number_id"
                name="phone_number_id"
                defaultValue={whatsappConfig.phone_number_id ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp_business_account_id">
                WhatsApp Business Account ID
              </Label>
              <Input
                id="whatsapp_business_account_id"
                name="whatsapp_business_account_id"
                defaultValue={whatsappConfig.whatsapp_business_account_id ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                name="access_token"
                type="password"
                defaultValue={whatsappConfig.access_token ?? ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar credenciales</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciales de Google Calendar</CardTitle>
          <CardDescription>
            Calendario y credenciales OAuth para agendar citas de este cliente.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(calendarConfig)} action={updateCalendarConfig}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="calendar_id">Calendar ID</Label>
              <Input
                id="calendar_id"
                name="calendar_id"
                placeholder="ejemplo@group.calendar.google.com"
                defaultValue={calendarConfig.calendar_id ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="google_client_id">Google Client ID</Label>
              <Input
                id="google_client_id"
                name="google_client_id"
                defaultValue={calendarConfig.google_client_id ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="google_client_secret">Google Client Secret</Label>
              <Input
                id="google_client_secret"
                name="google_client_secret"
                type="password"
                defaultValue={calendarConfig.google_client_secret ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="refresh_token">Refresh Token</Label>
              <Input
                id="refresh_token"
                name="refresh_token"
                type="password"
                defaultValue={calendarConfig.refresh_token ?? ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar credenciales</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciales de Email (Resend)</CardTitle>
          <CardDescription>
            Datos para confirmar citas por email a los clientes de este negocio.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(emailConfig)} action={updateEmailConfig}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="resend_api_key">Resend API Key</Label>
              <Input
                id="resend_api_key"
                name="resend_api_key"
                type="password"
                defaultValue={emailConfig.resend_api_key ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="from_email">Email remitente</Label>
              <Input
                id="from_email"
                name="from_email"
                placeholder="citas@negociodelcliente.com"
                defaultValue={emailConfig.from_email ?? ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar credenciales</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot de WhatsApp</CardTitle>
          <CardDescription>Prompt y base de conocimiento</CardDescription>
        </CardHeader>

        {error ? (
          <CardContent>
            <pre className="text-sm text-destructive">
              {JSON.stringify(error, null, 2)}
            </pre>
          </CardContent>
        ) : (
          <form
            key={JSON.stringify(agentConfig)}
            action={updateAgentConfig}
          >
            <input type="hidden" name="client_id" value={clientId} />

            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="system_prompt">
                  Prompt del bot (personalidad e instrucciones)
                </Label>
                <Textarea
                  id="system_prompt"
                  name="system_prompt"
                  defaultValue={agentConfig?.system_prompt ?? ""}
                  rows={8}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="knowledge_base">
                  Base de conocimiento (FAQ, productos, información extra)
                </Label>
                <Textarea
                  id="knowledge_base"
                  name="knowledge_base"
                  defaultValue={agentConfig?.knowledge_base ?? ""}
                  rows={8}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit">Guardar cambios</Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
