import { KIVUK } from "@/lib/web/kivuk";

/**
 * Marco común del aviso legal y la política de privacidad.
 *
 * Son páginas de texto seguido, así que en vez de repartir clases por cada
 * párrafo se estilan los hijos desde el contenedor: el contenido queda como
 * HTML plano y legible, que es lo que hay que poder revisar cuando lo lea un
 * asesor.
 */
export function PaginaLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 lg:py-24">
      <h1 className="text-3xl font-bold text-kivuk-pizarra sm:text-4xl">{titulo}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Última actualización: {actualizado}
      </p>

      <div
        className="mt-10 text-[15px] leading-relaxed text-kivuk-gris [&_a]:font-medium [&_a]:text-kivuk-azul-hondo [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-kivuk-pizarra [&_li]:mb-1.5 [&_p]:mb-4 [&_strong]:text-kivuk-pizarra [&_table]:my-4 [&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:align-top [&_td]:first:pr-6 [&_td]:first:font-medium [&_td]:first:text-kivuk-pizarra [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
      >
        {children}
      </div>
    </article>
  );
}

/**
 * Un dato del titular que la ley obliga a publicar.
 *
 * Mientras no esté relleno en `lib/web/kivuk.ts` sale marcado en rojo, y no en
 * blanco: un aviso legal incompleto que lo parezca se arregla; uno que finge
 * estar completo se publica y se olvida.
 */
export function DatoFiscal({ campo }: { campo: keyof typeof KIVUK.fiscal }) {
  const valor = KIVUK.fiscal[campo];
  if (valor) return <>{valor}</>;
  return (
    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-sm font-medium text-destructive">
      pendiente de rellenar en lib/web/kivuk.ts
    </span>
  );
}
