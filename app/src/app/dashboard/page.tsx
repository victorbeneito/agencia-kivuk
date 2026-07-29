import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewClientForm } from "./new-client-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Panel simple: lista de clientes de la agencia.
// Usa el cliente de servidor normal (respeta RLS con la sesión del usuario).
export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes</CardTitle>
        <CardDescription>
          Clientes de tu agencia y acceso a la configuración de su bot.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <NewClientForm />
        {error ? (
          <pre className="text-sm text-destructive">
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : clients && clients.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/${client.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(client.created_at).toLocaleDateString("es-ES")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay clientes todavía.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
