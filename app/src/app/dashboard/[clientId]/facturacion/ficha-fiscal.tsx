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
import { FORMAS_PAGO } from "@/lib/facturacion";
import { guardarDatosFiscalesCliente } from "@/app/dashboard/facturacion/acciones";

/**
 * Los datos con los que se le factura a este cliente.
 *
 * Son obligatorios para emitir: sin NIF y razón social del destinatario la
 * factura no es válida. El IVA, el IRPF y los días de vencimiento se dejan en
 * blanco casi siempre — vacío significa «lo que tenga puesto la agencia» — y
 * solo se rellenan en el caso raro: un cliente exento, uno que retiene, uno con
 * plazo de pago pactado distinto.
 */
export type PerfilFiscal = {
  razon_social: string;
  nif: string;
  direccion: string;
  codigo_postal: string;
  ciudad: string;
  provincia: string;
  pais: string;
  email: string;
  telefono: string;
  persona_contacto: string;
  forma_pago: string;
  iva: number | null;
  irpf: number | null;
  dias_vencimiento: number | null;
  notas: string;
};

const claseSelect =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs";

export function FichaFiscal({
  clientId,
  perfil,
  nombreCliente,
}: {
  clientId: string;
  perfil: PerfilFiscal | null;
  nombreCliente: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos fiscales</CardTitle>
        <CardDescription>
          Lo que aparecerá como destinatario en sus facturas. Sin NIF no se puede
          emitir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={guardarDatosFiscalesCliente} className="flex flex-col gap-4">
          <input type="hidden" name="client_id" value={clientId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="razon_social">Razón social</Label>
              <Input
                id="razon_social"
                name="razon_social"
                defaultValue={perfil?.razon_social || nombreCliente}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nif">NIF / CIF</Label>
              <Input id="nif" name="nif" defaultValue={perfil?.nif ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              name="direccion"
              defaultValue={perfil?.direccion ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="codigo_postal">C.P.</Label>
              <Input
                id="codigo_postal"
                name="codigo_postal"
                defaultValue={perfil?.codigo_postal ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input id="ciudad" name="ciudad" defaultValue={perfil?.ciudad ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="provincia">Provincia</Label>
              <Input
                id="provincia"
                name="provincia"
                defaultValue={perfil?.provincia ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pais">País</Label>
              <Input
                id="pais"
                name="pais"
                defaultValue={perfil?.pais ?? "España"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo de facturación</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={perfil?.email ?? ""}
                placeholder="administracion@cliente.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                defaultValue={perfil?.telefono ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="persona_contacto">Persona de contacto</Label>
              <Input
                id="persona_contacto"
                name="persona_contacto"
                defaultValue={perfil?.persona_contacto ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="forma_pago">Forma de pago</Label>
              <select
                id="forma_pago"
                name="forma_pago"
                defaultValue={perfil?.forma_pago ?? "transferencia"}
                className={claseSelect}
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="iva">IVA (%)</Label>
              <Input
                id="iva"
                name="iva"
                type="number"
                step="0.01"
                defaultValue={perfil?.iva ?? ""}
                placeholder="Por defecto"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="irpf">IRPF (%)</Label>
              <Input
                id="irpf"
                name="irpf"
                type="number"
                step="0.01"
                defaultValue={perfil?.irpf ?? ""}
                placeholder="Por defecto"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dias_vencimiento">Días para pagar</Label>
              <Input
                id="dias_vencimiento"
                name="dias_vencimiento"
                type="number"
                defaultValue={perfil?.dias_vencimiento ?? ""}
                placeholder="Por defecto"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas internas</Label>
            <Textarea
              id="notas"
              name="notas"
              rows={2}
              defaultValue={perfil?.notas ?? ""}
              placeholder="Paga siempre a fin de mes, factura a nombre de la matriz…"
            />
          </div>

          <Button type="submit" className="w-fit">
            Guardar datos fiscales
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
