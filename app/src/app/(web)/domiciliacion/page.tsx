import type { Metadata } from "next";
import { PaginaLegal } from "@/components/web/pagina-legal";
import { KIVUK } from "@/lib/web/kivuk";

export const metadata: Metadata = {
  title: "Domiciliación",
  robots: { index: false, follow: false },
};

/**
 * A donde vuelve el cliente desde la página de Stripe cuando ha firmado con el
 * enlace que le manda la agencia.
 *
 * Pública y no dentro de `/panel` porque ese enlace se abre muchas veces desde
 * un móvil sin sesión (el del propio cliente en la visita de alta, o el que le
 * llega por WhatsApp): mandarle al login justo después de firmar parecería un
 * error. Quien firma desde su panel vuelve a `/panel/facturas`, no aquí.
 */
export default async function Domiciliacion({
  searchParams,
}: {
  searchParams: Promise<{ domiciliacion?: string }>;
}) {
  const { domiciliacion } = await searchParams;
  const firmada = domiciliacion === "ok";

  return (
    <PaginaLegal
      titulo={firmada ? "Recibos domiciliados" : "Domiciliación sin terminar"}
      actualizado="septiembre de 2026"
    >
      {firmada ? (
        <>
          <p>
            Listo: la orden de domiciliación queda firmada. Las próximas cuotas se
            cargarán en esa cuenta y te llegará cada factura por correo unos días
            antes del cargo, con el importe.
          </p>
          <p>
            Stripe, la pasarela que gestiona los cobros de {KIVUK.nombre}, te
            manda además una copia de la orden a tu correo. Puedes cerrar esta
            página.
          </p>
        </>
      ) : (
        <p>
          No se ha guardado ninguna cuenta. Si ha sido sin querer, pídenos otro
          enlace por WhatsApp o escríbenos a{" "}
          <a href={`mailto:${KIVUK.email}`}>{KIVUK.email}</a>.
        </p>
      )}
    </PaginaLegal>
  );
}
