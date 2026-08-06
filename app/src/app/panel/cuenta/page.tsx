import { createClient } from "@/lib/supabase/server";
import { clienteDelPanel } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CambiarPassword } from "./cambiar-password";
import { AvisosForm } from "./avisos";

/**
 * Dos cosas distintas que caen en el mismo sitio: cómo entras y cómo te
 * avisamos.
 *
 * La contraseña solo la ve el cliente de verdad. Si es la agencia mirando su
 * panel, la sesión es la del administrador y «cambiar la contraseña» le
 * cambiaría la suya sin que lo pareciera. Los avisos sí los puede configurar,
 * porque es una preferencia del negocio y muchas veces la deja puesta la
 * agencia al dar de alta al cliente.
 */
export default async function CuentaPage() {
  const contexto = await clienteDelPanel();
  const supabase = await createClient();

  const { data: avisos } = await supabase
    .from("client_notification_settings")
    .select("en_panel, por_email, email, push")
    .eq("client_id", contexto.clientId)
    .maybeSingle();

  return (
    <div className="flex max-w-lg flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Avisos</CardTitle>
          <CardDescription>
            Cuando alguien pide hablar con una persona, ¿cómo quieres enterarte?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvisosForm
            inicial={{
              enPanel: avisos?.en_panel ?? true,
              porEmail: avisos?.por_email ?? false,
              email: avisos?.email ?? "",
              push: avisos?.push ?? false,
            }}
          />
        </CardContent>
      </Card>

      {!contexto.esVistaDeAgencia && (
        <Card>
          <CardHeader>
            <CardTitle>Tu acceso</CardTitle>
            <CardDescription>{contexto.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <CambiarPassword />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
