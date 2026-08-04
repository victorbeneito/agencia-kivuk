"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Mismo modelo para indexar y para consultar, siempre. Si algún día se cambia,
 * hay que reindexar todos los documentos de todos los clientes: los vectores de
 * dos modelos distintos no son comparables entre sí.
 */
const MODELO_EMBEDDING = "text-embedding-3-small";

const MAX_CHUNK = 1000;
const SOLAPE = 150;
/** Por debajo de esto el documento va entero: partirlo solo empeora la búsqueda. */
const UMBRAL_TROCEADO = 1200;

/**
 * Trocea un documento para indexarlo.
 *
 * Cada trozo lleva delante el título del documento. Es un detalle pequeño con
 * mucho efecto: un trozo que empieza por "[Envíos — plazos y coste]" se recupera
 * al preguntar "¿cuánto tarda?" aunque su texto no diga la palabra "envío".
 */
function trocear(titulo: string, contenido: string): string[] {
  const texto = contenido.trim();
  const encabezar = (t: string) => `[${titulo}]\n\n${t}`;

  if (texto.length <= UMBRAL_TROCEADO) return [encabezar(texto)];

  const parrafos = texto.split(/\n\s*\n/).filter((p) => p.trim());
  const trozos: string[] = [];
  let actual = "";

  for (const parrafo of parrafos) {
    if (actual && actual.length + parrafo.length + 2 > MAX_CHUNK) {
      trozos.push(actual);
      // Se arrastra la cola del trozo anterior para no cortar una idea en seco.
      actual = actual.slice(-SOLAPE) + "\n\n" + parrafo;
    } else {
      actual = actual ? `${actual}\n\n${parrafo}` : parrafo;
    }
  }
  if (actual.trim()) trozos.push(actual);

  return trozos.map(encabezar);
}

/** Un solo POST con todos los trozos: la API acepta un array de entradas. */
async function generarEmbeddings(textos: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta OPENAI_API_KEY en el entorno: sin ella no se puede indexar el conocimiento."
    );
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODELO_EMBEDDING, input: textos }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI devolvió ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data: { index: number; embedding: number[] }[];
  };

  // La API no garantiza el orden de la respuesta; se reordena por `index`.
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Reindexa un documento: borra sus trozos y los vuelve a generar.
 *
 * Se llama siempre al guardar, no desde un botón aparte. Si dependiera de una
 * acción manual, tarde o temprano habría documentos editados sin reindexar y el
 * bot respondería con datos viejos sin que nadie se diera cuenta.
 */
async function reindexar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  clientId: string,
  titulo: string,
  contenido: string
) {
  await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

  const trozos = trocear(titulo, contenido);
  const embeddings = await generarEmbeddings(trozos);

  const { error } = await supabase.from("knowledge_chunks").insert(
    trozos.map((content, i) => ({
      client_id: clientId,
      document_id: documentId,
      content,
      embedding: embeddings[i],
    }))
  );

  if (error) throw new Error(`No se pudieron guardar los trozos: ${error.message}`);

  return trozos.length;
}

export async function guardarDocumento(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "faq");
  const content = String(formData.get("content") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();

  if (!title || !content) {
    return { ok: false as const, error: "El título y el contenido son obligatorios." };
  }

  const supabase = await createClient();

  try {
    let id = documentId;

    if (id) {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({
          title,
          category,
          content,
          source_url: sourceUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("client_id", clientId);

      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .insert({
          client_id: clientId,
          title,
          category,
          content,
          source_url: sourceUrl || null,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      id = data.id;
    }

    const trozos = await reindexar(supabase, id, clientId, title, content);

    revalidatePath(`/dashboard/${clientId}/conocimiento`);
    return { ok: true as const, trozos };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Error desconocido al guardar.",
    };
  }
}

export async function eliminarDocumento(clientId: string, documentId: string) {
  const supabase = await createClient();

  // Los trozos caen solos por el `on delete cascade` de la clave foránea.
  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId)
    .eq("client_id", clientId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/dashboard/${clientId}/conocimiento`);
  return { ok: true as const };
}
