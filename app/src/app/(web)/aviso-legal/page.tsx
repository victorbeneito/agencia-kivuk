import type { Metadata } from "next";
import Link from "next/link";
import { DatoFiscal, PaginaLegal } from "@/components/web/pagina-legal";
import { KIVUK } from "@/lib/web/kivuk";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: `Datos identificativos y condiciones de uso de ${KIVUK.dominio}.`,
  robots: { index: false, follow: true },
};

export default function AvisoLegal() {
  return (
    <PaginaLegal titulo="Aviso legal" actualizado="septiembre de 2026">
      <h2>Quién está detrás de esta web</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002 de servicios de la
        sociedad de la información y de comercio electrónico (LSSI-CE), estos son
        los datos del titular de <strong>{KIVUK.dominio}</strong>:
      </p>
      <table>
        <tbody>
          <tr>
            <td>Titular</td>
            <td>
              <DatoFiscal campo="titular" />
            </td>
          </tr>
          <tr>
            <td>NIF</td>
            <td>
              <DatoFiscal campo="nif" />
            </td>
          </tr>
          <tr>
            <td>Domicilio</td>
            <td>
              <DatoFiscal campo="domicilio" />
            </td>
          </tr>
          <tr>
            <td>Correo</td>
            <td>
              <a href={`mailto:${KIVUK.email}`}>{KIVUK.email}</a>
            </td>
          </tr>
          <tr>
            <td>Nombre comercial</td>
            <td>{KIVUK.nombre}</td>
          </tr>
        </tbody>
      </table>

      <h2>A qué se dedica</h2>
      <p>
        {KIVUK.nombre} presta servicios de automatización con inteligencia
        artificial para negocios: atención por WhatsApp, gestión de agenda, envío
        de correos y creación y publicación de contenido en redes sociales, junto
        con el panel en el que cada cliente ve y gestiona lo suyo.
      </p>

      <h2>Uso de la web</h2>
      <p>
        Esta web es informativa. Quien la visita se compromete a no usarla para
        fines ilícitos, a no intentar acceder a zonas restringidas —el panel de
        clientes lo está— y a no realizar acciones que puedan dañar el servicio o
        impedir su funcionamiento normal.
      </p>
      <p>
        El acceso al panel en{" "}
        <a href={KIVUK.panel}>{KIVUK.panel.replace("https://", "")}</a> está
        reservado a clientes con credenciales propias y se rige por el contrato
        de servicio firmado con cada uno, no por este aviso.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Los textos, el diseño, el logotipo y el resto de elementos de esta web son
        propiedad de su titular o se usan con autorización. Se pueden citar y
        enlazar libremente; reproducirlos con fines comerciales, no, salvo permiso
        por escrito.
      </p>
      <p>
        Las marcas de terceros que aparecen mencionadas —WhatsApp, Instagram,
        Facebook, Google— pertenecen a sus titulares y se nombran únicamente para
        describir con qué servicios trabajamos. No existe relación de patrocinio
        ni de representación con ninguna de ellas.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Ponemos cuidado en que lo que se cuenta aquí sea exacto, pero la
        información de esta web es general y no sustituye a una propuesta
        concreta: las condiciones, el alcance y el precio de cada servicio son los
        que figuren en el presupuesto y el contrato firmados.
      </p>
      <p>
        No respondemos del contenido de las webs de terceros a las que se pueda
        enlazar desde aquí, ni de las interrupciones del servicio que tengan su
        origen en causas ajenas (caídas de los proveedores de infraestructura,
        cambios en las plataformas de terceros o incidencias de fuerza mayor).
      </p>

      <h2>Datos personales</h2>
      <p>
        El tratamiento de los datos que se recogen en el formulario de contacto se
        explica en la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>

      <h2>Ley aplicable</h2>
      <p>
        Esta web y las relaciones que surjan de ella se rigen por la legislación
        española. Para cualquier controversia, las partes se someten a los
        juzgados y tribunales del domicilio del titular, salvo cuando la ley
        imponga otro fuero —como ocurre con las personas consumidoras.
      </p>
    </PaginaLegal>
  );
}
