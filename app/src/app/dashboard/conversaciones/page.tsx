import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
import { Badge } from "@/components/ui/badge";

export default async function ConversacionesPage() {
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, client_id, channel, external_contact_id, created_at, clients(name)")
    .order("created_at", { ascending: false });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversaciones</CardTitle>
        <CardDescription>
          Todas las conversaciones de los clientes de tu agencia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <pre className="text-sm text-destructive">
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : conversations && conversations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((conversation) => (
                <TableRow key={conversation.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/${conversation.client_id}/conversaciones/${conversation.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {conversation.clients?.[0]?.name ?? "Cliente"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{conversation.channel}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {conversation.external_contact_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(conversation.created_at).toLocaleString("es-ES")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no hay conversaciones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
