import { requireCliente } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CambiarPassword } from "./cambiar-password";

/**
 * El acceso lo crea la agencia y entrega una contraseña temporal. Sin esta
 * pantalla esa contraseña sería para siempre: una cadena aleatoria que alguien
 * dictó por teléfono y que acaba en un pósit. Cambiarla es lo primero que hará
 * cualquiera que reciba un acceso así.
 */
export default async function CuentaPage() {
  const perfil = await requireCliente();

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Tu acceso</CardTitle>
          <CardDescription>{perfil.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <CambiarPassword />
        </CardContent>
      </Card>
    </div>
  );
}
