/**
 * Las seis categorías de documento. Están replicadas como restricción en la
 * base (`0006_rag.sql`): si se añade una aquí, hay que añadirla allí también.
 *
 * Viven en su propio archivo porque `actions.ts` lleva "use server" y esos
 * archivos solo pueden exportar funciones async.
 */
export const CATEGORIAS = [
  { valor: "empresa", etiqueta: "La empresa" },
  { valor: "envio", etiqueta: "Envíos" },
  { valor: "devolucion", etiqueta: "Devoluciones" },
  { valor: "producto", etiqueta: "Productos" },
  { valor: "pago", etiqueta: "Pagos" },
  { valor: "faq", etiqueta: "Preguntas frecuentes" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["valor"];

export const ETIQUETA_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.valor, c.etiqueta])
);
