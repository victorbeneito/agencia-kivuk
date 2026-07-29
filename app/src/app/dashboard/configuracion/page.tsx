import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfiguracionAgenciaPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de la agencia</CardTitle>
        <CardDescription>
          Próximamente: nombre/logo de la agencia y ajustes generales (Paso 5 del plan).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          De momento la gestión de clientes está en &quot;Clientes&quot;.
        </p>
      </CardContent>
    </Card>
  );
}
