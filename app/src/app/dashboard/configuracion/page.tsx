import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { guardarDatosAgencia } from "../facturacion/acciones";

/**
 * Configuración de la agencia: de momento, sus datos fiscales.
 *
 * Están aquí y no en la pantalla de facturación porque no son de la facturación:
 * son quién eres. La facturación es el primer sitio donde hacen falta, pero el
 * mismo bloque servirá para el membrete de los correos o para el logotipo de las
 * propuestas.
 */
export default async function ConfiguracionAgenciaPage() {
  const perfil = await requireAgencia();
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("owner_user_id", perfil.userId)
    .single();

  const { data: ajustes } = await supabase
    .from("agency_billing_settings")
    .select("*")
    .eq("agency_id", agency?.id ?? "")
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Configuración de la agencia
        </h1>
        <p className="text-sm text-muted-foreground">
          Los datos con los que emites: aparecen como emisor en cada factura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales y de cobro</CardTitle>
          <CardDescription>
            Razón social y NIF son obligatorios para poder emitir. El IBAN sale
            impreso en la factura para que el cliente sepa dónde pagar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={guardarDatosAgencia} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="razon_social">Razón social</Label>
                <Input
                  id="razon_social"
                  name="razon_social"
                  defaultValue={ajustes?.razon_social || agency?.name || ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nif">NIF / CIF</Label>
                <Input id="nif" name="nif" defaultValue={ajustes?.nif ?? ""} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                defaultValue={ajustes?.direccion ?? ""}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="codigo_postal">C.P.</Label>
                <Input
                  id="codigo_postal"
                  name="codigo_postal"
                  defaultValue={ajustes?.codigo_postal ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" name="ciudad" defaultValue={ajustes?.ciudad ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Input
                  id="provincia"
                  name="provincia"
                  defaultValue={ajustes?.provincia ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pais">País</Label>
                <Input
                  id="pais"
                  name="pais"
                  defaultValue={ajustes?.pais ?? "España"}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={ajustes?.email ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  defaultValue={ajustes?.telefono ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="web">Web</Label>
                <Input id="web" name="web" defaultValue={ajustes?.web ?? ""} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                name="iban"
                defaultValue={ajustes?.iban ?? ""}
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="serie">Serie</Label>
                <Input
                  id="serie"
                  name="serie"
                  defaultValue={ajustes?.serie ?? "F"}
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">
                  Números como {ajustes?.serie ?? "F"}
                  {new Date().getFullYear()}-0001
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="iva_por_defecto">IVA por defecto (%)</Label>
                <Input
                  id="iva_por_defecto"
                  name="iva_por_defecto"
                  type="number"
                  step="0.01"
                  defaultValue={ajustes?.iva_por_defecto ?? 21}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="irpf_por_defecto">IRPF por defecto (%)</Label>
                <Input
                  id="irpf_por_defecto"
                  name="irpf_por_defecto"
                  type="number"
                  step="0.01"
                  defaultValue={ajustes?.irpf_por_defecto ?? 0}
                />
                <p className="text-xs text-muted-foreground">
                  Solo si eres autónomo y facturas a empresas.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dias_vencimiento">Días para pagar</Label>
                <Input
                  id="dias_vencimiento"
                  name="dias_vencimiento"
                  type="number"
                  defaultValue={ajustes?.dias_vencimiento ?? 15}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pie_factura">Texto al pie de la factura</Label>
              <Textarea
                id="pie_factura"
                name="pie_factura"
                rows={3}
                defaultValue={ajustes?.pie_factura ?? ""}
                placeholder="Condiciones de pago, recargo por demora, aviso de protección de datos…"
              />
            </div>

            <Button type="submit" className="w-fit">
              Guardar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numeración</CardTitle>
          <CardDescription>
            Siguiente factura: <strong>
              {ajustes?.serie ?? "F"}
              {ajustes?.ejercicio ?? new Date().getFullYear()}-
              {String(ajustes?.siguiente_numero ?? 1).padStart(4, "0")}
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El contador lo lleva la base de datos y se reinicia solo al cambiar de
            año. No se edita desde aquí a propósito: la numeración tiene que ser
            correlativa y sin huecos, y un número escrito a mano es la forma más
            fácil de romperla.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
