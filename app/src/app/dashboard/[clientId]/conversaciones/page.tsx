import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

export default async function ClientConversacionesPage({
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

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, channel, external_contact_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/dashboard/${clientId}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a {client?.name ?? "cliente"}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Conversaciones de {client?.name ?? "cliente"}</CardTitle>
          <CardDescription>
            Conversaciones registradas para este cliente.
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
                        href={`/dashboard/${clientId}/conversaciones/${conversation.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        <Badge variant="secondary">{conversation.channel}</Badge>
                      </Link>
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
              Todavía no hay conversaciones para este cliente.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
