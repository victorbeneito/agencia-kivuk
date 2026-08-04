"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { guardarDocumento, eliminarDocumento } from "./actions";
import { CATEGORIAS, ETIQUETA_CATEGORIA } from "./categorias";

export type DocumentoData = {
  id: string;
  title: string;
  category: string;
  content: string;
  source_url: string | null;
  /** Trozos indexados. Un 0 aquí significa que el bot NO ve este documento. */
  trozos: number;
};

const CLASE_SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Formulario({
  clientId,
  doc,
  onHecho,
}: {
  clientId: string;
  doc?: DocumentoData;
  onHecho: () => void;
}) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");

  return (
    <form
      action={(formData) =>
        empezar(async () => {
          setError("");
          const r = await guardarDocumento(formData);
          if (r.ok) onHecho();
          else setError(r.error);
        })
      }
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="client_id" value={clientId} />
      {doc && <input type="hidden" name="document_id" value={doc.id} />}

      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`title-${doc?.id ?? "nuevo"}`}>Título</Label>
          <Input
            id={`title-${doc?.id ?? "nuevo"}`}
            name="title"
            defaultValue={doc?.title ?? ""}
            placeholder="Envíos — plazos, coste y zonas"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`category-${doc?.id ?? "nuevo"}`}>Categoría</Label>
          <select
            id={`category-${doc?.id ?? "nuevo"}`}
            name="category"
            defaultValue={doc?.category ?? "faq"}
            className={CLASE_SELECT}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`content-${doc?.id ?? "nuevo"}`}>Contenido</Label>
        <Textarea
          id={`content-${doc?.id ?? "nuevo"}`}
          name="content"
          defaultValue={doc?.content ?? ""}
          rows={12}
          required
          placeholder="Escríbelo como si se lo explicaras a un cliente por teléfono: frases completas, datos concretos y nada de menús ni texto de la web."
        />
        <p className="text-xs text-muted-foreground">
          Un documento por tema. Mejor cinco documentos cortos y claros que uno
          largo con todo mezclado.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`source-${doc?.id ?? "nuevo"}`}>
          URL de origen (opcional)
        </Label>
        <Input
          id={`source-${doc?.id ?? "nuevo"}`}
          name="source_url"
          type="url"
          defaultValue={doc?.source_url ?? ""}
          placeholder="https://www.ejemplo.com/envios"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando e indexando…" : "Guardar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onHecho} disabled={pendiente}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function NuevoDocumento({ clientId }: { clientId: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return <Button onClick={() => setAbierto(true)}>Añadir documento</Button>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Nuevo documento</CardTitle>
        <CardDescription>
          Al guardar se indexa automáticamente para que el bot pueda usarlo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Formulario clientId={clientId} onHecho={() => setAbierto(false)} />
      </CardContent>
    </Card>
  );
}

export function Documento({
  clientId,
  doc,
}: {
  clientId: string;
  doc: DocumentoData;
}) {
  const [editando, setEditando] = useState(false);
  const [pendiente, empezar] = useTransition();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{doc.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {ETIQUETA_CATEGORIA[doc.category] ?? doc.category}
              </Badge>
              {doc.trozos > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {doc.trozos} {doc.trozos === 1 ? "trozo" : "trozos"} indexados
                </span>
              ) : (
                <Badge variant="destructive">
                  Sin indexar — el bot no lo ve
                </Badge>
              )}
            </div>
          </div>
          {!editando && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pendiente}
                onClick={() =>
                  empezar(async () => {
                    if (!confirm(`¿Eliminar «${doc.title}»?`)) return;
                    await eliminarDocumento(clientId, doc.id);
                  })
                }
              >
                Eliminar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editando ? (
          <Formulario
            clientId={clientId}
            doc={doc}
            onHecho={() => setEditando(false)}
          />
        ) : (
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {doc.content}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
