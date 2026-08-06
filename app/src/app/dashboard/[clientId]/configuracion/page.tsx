import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AccesoCliente, type UsuarioCliente } from "../acceso-cliente";
import { VerPanelDelCliente } from "../ver-panel";
import {
  updateAgentConfig,
  updateBrandConfig,
  updateCalendarConfig,
  updateCalendarSchedule,
  updateEmailConfig,
  updateSocialConfig,
  updateVoiceConfig,
  updateWhatsappConfig,
  type ModuleName,
} from "../actions";
import { ModuleToggle } from "../module-toggle";
import {
  Card,
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
  social: "Redes sociales",
};

// 1 = lunes ... 7 = domingo (mismo criterio que el workflow de n8n).
const DIAS_SEMANA = [
  { valor: "1", etiqueta: "L" },
  { valor: "2", etiqueta: "M" },
  { valor: "3", etiqueta: "X" },
  { valor: "4", etiqueta: "J" },
  { valor: "5", etiqueta: "V" },
  { valor: "6", etiqueta: "S" },
  { valor: "7", etiqueta: "D" },
];

// Deben coincidir con los del nodo "Preparar contexto" en n8n, que aplica
// estos mismos valores cuando el cliente todavía no ha guardado su horario.
const HORARIO_POR_DEFECTO = {
  dias_laborables: "1,2,3,4,5",
  manana_inicio: "09:00",
  manana_fin: "14:00",
  tarde_inicio: "16:00",
  tarde_fin: "20:00",
  duracion_min: "60",
  paso_min: "15",
};

const MODULE_ORDER: ModuleName[] = [
  "whatsapp",
  "voice",
  "calendar",
  "email",
  "social",
];

export default async function ClientConfigPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

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

  // El email vive en `auth.users`, que no se consulta con la sesión del usuario:
  // hace falta `service_role`. La lista es de dos o tres personas por cliente,
  // así que se pide una por una en vez de traerse el directorio entero.
  const admin = createServiceRoleClient();
  const { data: perfilesCliente } = await admin
    .from("user_profiles")
    .select("id")
    .eq("client_id", clientId)
    .eq("role", "client_user");

  const usuarios: UsuarioCliente[] = (
    await Promise.all(
      (perfilesCliente ?? []).map(async ({ id }) => {
        const { data } = await admin.auth.admin.getUserById(id);
        if (!data.user) return null;
        return {
          id,
          email: data.user.email ?? "(sin email)",
          ultimoAcceso: data.user.last_sign_in_at ?? null,
        };
      })
    )
  ).filter((u): u is UsuarioCliente => u !== null);

  const whatsappConfig =
    (moduleByName.get("whatsapp")?.config as Record<string, string> | null) ??
    {};
  const calendarConfig =
    (moduleByName.get("calendar")?.config as Record<string, string> | null) ??
    {};
  const emailConfig =
    (moduleByName.get("email")?.config as Record<string, string> | null) ??
    {};
  const voiceConfig =
    (moduleByName.get("voice")?.config as Record<string, string> | null) ?? {};
  const socialConfig =
    (moduleByName.get("social")?.config as Record<string, string> | null) ??
    {};

  // El horario vive en el mismo config que las credenciales de Calendar, así
  // que rellenamos con los valores por defecto lo que el cliente no haya tocado.
  const horario = {
    dias_laborables:
      calendarConfig.dias_laborables || HORARIO_POR_DEFECTO.dias_laborables,
    manana_inicio:
      calendarConfig.manana_inicio ?? HORARIO_POR_DEFECTO.manana_inicio,
    manana_fin: calendarConfig.manana_fin ?? HORARIO_POR_DEFECTO.manana_fin,
    tarde_inicio:
      calendarConfig.tarde_inicio ?? HORARIO_POR_DEFECTO.tarde_inicio,
    tarde_fin: calendarConfig.tarde_fin ?? HORARIO_POR_DEFECTO.tarde_fin,
    duracion_min:
      calendarConfig.duracion_min || HORARIO_POR_DEFECTO.duracion_min,
    paso_min: calendarConfig.paso_min || HORARIO_POR_DEFECTO.paso_min,
  };

  const diasActivos = new Set(horario.dias_laborables.split(",").filter(Boolean));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
          <CardDescription>
            Qué servicios tiene contratados este cliente. Al desactivar uno, sus
            automatizaciones dejan de responder pero su configuración se
            conserva.
          </CardDescription>
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
          <CardTitle>Acceso del cliente al panel</CardTitle>
          <CardDescription>
            Quién puede entrar en{" "}
            <span className="font-mono text-xs">/panel</span> a ver sus
            conversaciones y su contenido. Solo verá los módulos que tenga
            activos, y nunca las credenciales ni el prompt del bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <AccesoCliente clientId={clientId} usuarios={usuarios} />

          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <p className="text-sm font-medium">¿Necesitas ver lo que él ve?</p>
            <p className="text-sm text-muted-foreground">
              No hay forma de saber la contraseña de un cliente: Supabase guarda
              un cálculo irreversible, no la contraseña, y así debe ser. Para
              revisar su panel entras con tu propio usuario, sin pedirle nada ni
              cambiarle el acceso.
            </p>
            <div className="mt-1">
              <VerPanelDelCliente clientId={clientId} />
            </div>
          </div>
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
          <CardTitle>Agente de voz (Vapi)</CardTitle>
          <CardDescription>
            El ID del assistant es lo que identifica a este cliente cuando entra
            una llamada, así que debe coincidir exactamente con el de Vapi.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(voiceConfig)} action={updateVoiceConfig}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vapi_assistant_id">Assistant ID de Vapi</Label>
              <Input
                id="vapi_assistant_id"
                name="vapi_assistant_id"
                placeholder="1a2b3c4d-..."
                defaultValue={voiceConfig.vapi_assistant_id ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vapi_phone_number">
                Número de teléfono <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="vapi_phone_number"
                name="vapi_phone_number"
                placeholder="+34..."
                defaultValue={voiceConfig.vapi_phone_number ?? ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar agente de voz</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de la tienda</CardTitle>
          <CardDescription>
            De aquí sale la materia prima del contenido: n8n recorre el sitemap
            y guarda nombre, precio, foto y enlace de cada producto. Reconoce
            las fichas por sus datos estructurados, así que funciona con
            PrestaShop, WooCommerce o Shopify sin configurar nada más.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(socialConfig)} action={updateSocialConfig}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="catalog_sitemap_url">URL del sitemap</Label>
              <Input
                id="catalog_sitemap_url"
                name="catalog_sitemap_url"
                placeholder="https://tutienda.com/sitemap.xml"
                defaultValue={socialConfig.catalog_sitemap_url ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="catalog_url_pattern">
                Filtro de URLs{" "}
                <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="catalog_url_pattern"
                name="catalog_url_pattern"
                placeholder="/productos/"
                defaultValue={socialConfig.catalog_url_pattern ?? ""}
              />
              <p className="text-sm text-muted-foreground">
                Déjalo vacío salvo que la tienda tenga miles de páginas que no
                son producto. Un filtro demasiado estricto se deja productos
                fuera sin avisar.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ig_user_id">
                Instagram Business ID{" "}
                <span className="text-muted-foreground">(para publicar)</span>
              </Label>
              <Input
                id="ig_user_id"
                name="ig_user_id"
                placeholder="17841400000000000"
                defaultValue={socialConfig.ig_user_id ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ig_access_token">Token de acceso</Label>
              <Input
                id="ig_access_token"
                name="ig_access_token"
                type="password"
                placeholder="EAA..."
                defaultValue={socialConfig.ig_access_token ?? ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar catálogo</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identidad de marca</CardTitle>
          <CardDescription>
            Cómo suenan y cómo se ven las piezas generadas. El tono va tal cual
            a la IA que escribe los textos; los colores, a la plantilla de las
            imágenes.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(socialConfig)} action={updateBrandConfig}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ig_handle">Cuenta de Instagram</Label>
                <Input
                  id="ig_handle"
                  name="ig_handle"
                  placeholder="@tucuenta"
                  defaultValue={socialConfig.ig_handle ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="web">Web</Label>
                <Input
                  id="web"
                  name="web"
                  placeholder="tutienda.com"
                  defaultValue={socialConfig.web ?? ""}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tono">Tono de los textos</Label>
              <textarea
                id="tono"
                name="tono"
                rows={2}
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring/50 min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
                placeholder="cercano y natural, tratando de tú, sin lenguaje publicitario"
                defaultValue={socialConfig.tono ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="producto_estrella">Producto estrella</Label>
                <Input
                  id="producto_estrella"
                  name="producto_estrella"
                  placeholder="estor"
                  defaultValue={socialConfig.producto_estrella ?? ""}
                />
                <p className="text-sm text-muted-foreground">
                  Palabra que aparece en el nombre de tu producto principal. Los
                  lotes lo priorizarán, variando la temática para que no se
                  repita.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="peso_estrella">% de cada lote</Label>
                <Input
                  id="peso_estrella"
                  name="peso_estrella"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="60"
                  defaultValue={socialConfig.peso_estrella ?? ""}
                />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                name="mostrar_precio"
                defaultChecked={socialConfig.mostrar_precio === "true"}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Enseñar el precio en la imagen
                </span>
                <span className="text-sm text-muted-foreground">
                  Déjalo sin marcar si el mismo producto tiene varios tamaños:
                  el catálogo guarda el precio de partida, y enseñar esa cifra
                  promete algo que en otras medidas no se cumple.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="color_primario">Color principal</Label>
                <Input
                  id="color_primario"
                  name="color_primario"
                  placeholder="#6D9AAC"
                  defaultValue={socialConfig.color_primario ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="color_secundario">Color de acento</Label>
                <Input
                  id="color_secundario"
                  name="color_secundario"
                  placeholder="#CEB38D"
                  defaultValue={socialConfig.color_secundario ?? ""}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar identidad</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario de atención</CardTitle>
          <CardDescription>
            El bot solo ofrece citas dentro de este horario, y comprueba la
            agenda para no dar una hora que ya esté ocupada.
          </CardDescription>
        </CardHeader>
        <form key={JSON.stringify(horario)} action={updateCalendarSchedule}>
          <input type="hidden" name="client_id" value={clientId} />
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>Días laborables</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <label
                    key={dia.valor}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      name="dias_laborables"
                      value={dia.valor}
                      defaultChecked={diasActivos.has(dia.valor)}
                      className="size-4 accent-primary"
                    />
                    {dia.etiqueta}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="manana_inicio">Mañana: desde</Label>
                <Input
                  id="manana_inicio"
                  name="manana_inicio"
                  type="time"
                  defaultValue={horario.manana_inicio}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manana_fin">Mañana: hasta</Label>
                <Input
                  id="manana_fin"
                  name="manana_fin"
                  type="time"
                  defaultValue={horario.manana_fin}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tarde_inicio">Tarde: desde</Label>
                <Input
                  id="tarde_inicio"
                  name="tarde_inicio"
                  type="time"
                  defaultValue={horario.tarde_inicio}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tarde_fin">Tarde: hasta</Label>
                <Input
                  id="tarde_fin"
                  name="tarde_fin"
                  type="time"
                  defaultValue={horario.tarde_fin}
                />
              </div>
            </div>
            <p className="-mt-2 text-sm text-muted-foreground">
              Si el negocio no cierra a mediodía, deja los dos campos de tarde
              vacíos y pon el horario completo en los de mañana.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="duracion_min">Duración de cada cita</Label>
                <select
                  id="duracion_min"
                  name="duracion_min"
                  defaultValue={horario.duracion_min}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                >
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="90">1 hora y media</option>
                  <option value="120">2 horas</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="paso_min">Una cita puede empezar cada</Label>
                <select
                  id="paso_min"
                  name="paso_min"
                  defaultValue={horario.paso_min}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                >
                  <option value="15">15 minutos (9:00, 9:15, 9:30…)</option>
                  <option value="30">30 minutos (9:00, 9:30, 10:00…)</option>
                  <option value="60">1 hora (9:00, 10:00, 11:00…)</option>
                </select>
              </div>
            </div>
            <p className="-mt-2 text-sm text-muted-foreground">
              La duración es lo que ocupa la cita en la agenda. El intervalo es
              cada cuánto puede empezar una: con citas de 1 hora e intervalo de
              15 minutos, si hay hueco se puede reservar a las 10:15.
            </p>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar horario</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciales de Email (Resend)</CardTitle>
          <CardDescription>
            Para las confirmaciones de cita y los avisos de «pide hablar con una
            persona».{" "}
            <strong>
              El remitente tiene que ser de un dominio verificado en Resend
            </strong>
            : con cualquier otro —incluido{" "}
            <span className="font-mono text-xs">onboarding@resend.dev</span>—
            Resend acepta la petición pero no entrega el correo, y el fallo solo
            se ve entrando en su panel.
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
