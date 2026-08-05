import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
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

/**
 * En un join de muchos a uno (`conversations.client_id → clients`) PostgREST
 * devuelve un objeto, no un array. Leerlo como `clients[0]` daba siempre
 * `undefined` y salía el texto de reserva, que además se parecía al nombre real
 * del cliente de pruebas y disimuló el fallo. Se aceptan las dos formas para no
 * depender de cómo lo tipe el cliente de Supabase.
 */
function nombreDelCliente(
  clients: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!clients) return null;
  const fila = Array.isArray(clients) ? clients[0] : clients;
  return fila?.name ?? null;
}

/**
 * Vista de agencia de todas las conversaciones, de todos los clientes.
 *
 * No es una bandeja: para responder se entra en la del cliente. Esto es el
 * repaso de la mañana — quién está esperando y de qué cliente— ordenado por
 * actividad reciente, no por cuándo se abrió el hilo.
 */
type FilaGlobal = {
  id: string;
  client_id: string;
  channel: string;
  external_contact_id: string | null;
  contact_name: string | null;
  mode: string;
  handoff_requested_at: string | null;
  unread_count: number | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  clients: { name: string } | { name: string }[] | null;
};

export default async function ConversacionesPage() {
  await requireAgencia();
  const supabase = await createClient();

  // `.returns()` en vez de dejar que lo infiera: el parser de tipos de
  // supabase-js se rinde con selects de muchas columnas y devuelve
  // `GenericStringError`, que luego rompe cada acceso a un campo.
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      "id, client_id, channel, external_contact_id, contact_name, mode, handoff_requested_at, unread_count, last_message_at, last_message_preview, clients(name)"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .returns<FilaGlobal[]>();

  const esperando = (conversations ?? []).filter(
    (c) => c.handoff_requested_at && c.mode !== "human"
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversaciones</CardTitle>
        <CardDescription>
          Todas las conversaciones de los clientes de tu agencia, por actividad
          reciente.
          {esperando > 0 &&
            ` ${esperando} ${esperando === 1 ? "espera" : "esperan"} a que entre una persona.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <pre className="text-sm text-destructive">
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : conversations && conversations.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Último mensaje</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow key={conversation.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/${conversation.client_id}/conversaciones`}
                        className="font-medium text-primary hover:underline"
                      >
                        {nombreDelCliente(conversation.clients) ?? "Sin nombre"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        // Un color por canal: en una tabla larga se distingue de
                        // un vistazo sin tener que leer la columna.
                        className={
                          conversation.channel === "voice"
                            ? "bg-[#D0BC82]/30 text-[#87752f]"
                            : "bg-[#8EB9C5]/25 text-[#3b7686]"
                        }
                      >
                        {conversation.channel === "voice"
                          ? "Voz"
                          : conversation.channel === "whatsapp"
                            ? "WhatsApp"
                            : conversation.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {conversation.contact_name ??
                        conversation.external_contact_id ??
                        "—"}
                    </TableCell>
                    <TableCell className="max-w-72">
                      <span className="line-clamp-1 text-sm">
                        {conversation.last_message_preview ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {conversation.last_message_at
                          ? new Date(
                              conversation.last_message_at
                            ).toLocaleString("es-ES")
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {conversation.handoff_requested_at &&
                          conversation.mode !== "human" && (
                            <Badge className="bg-[#B45831]/15 text-[#B45831]">
                              Pide una persona
                            </Badge>
                          )}
                        {conversation.mode === "human" && (
                          <Badge variant="secondary">Atiende una persona</Badge>
                        )}
                        {(conversation.unread_count ?? 0) > 0 && (
                          <Badge variant="outline">
                            {conversation.unread_count} sin leer
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no hay conversaciones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
