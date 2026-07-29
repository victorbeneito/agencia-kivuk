import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ clientId: string; conversationId: string }>;
}) {
  const { clientId, conversationId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("channel, external_contact_id")
    .eq("id", conversationId)
    .single();

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/dashboard/${clientId}/conversaciones`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a conversaciones de {client?.name ?? "cliente"}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {conversation?.channel ?? "Conversación"}
            {conversation?.external_contact_id
              ? ` — ${conversation.external_contact_id}`
              : ""}
          </CardTitle>
          <CardDescription>Hilo de mensajes</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <pre className="text-sm text-destructive">
              {JSON.stringify(error, null, 2)}
            </pre>
          ) : messages && messages.length > 0 ? (
            <div className="flex flex-col gap-3">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col gap-1",
                      isUser ? "items-start" : "items-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                        isUser
                          ? "bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {message.content}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleString("es-ES")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta conversación todavía no tiene mensajes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
