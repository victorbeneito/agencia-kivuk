import type { Metadata } from "next";
import { DatoFiscal, PaginaLegal } from "@/components/web/pagina-legal";
import { KIVUK } from "@/lib/web/kivuk";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos recoge ${KIVUK.dominio}, para qué y durante cuánto tiempo.`,
  robots: { index: false, follow: true },
};

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="septiembre de 2026">
      <p>
        Esta página explica qué pasa con los datos que dejas en{" "}
        <strong>{KIVUK.dominio}</strong>. Está escrita para entenderse, no para
        cubrirnos: si algo no queda claro, escríbenos a{" "}
        <a href={`mailto:${KIVUK.email}`}>{KIVUK.email}</a> y lo aclaramos.
      </p>

      <h2>Quién trata tus datos</h2>
      <table>
        <tbody>
          <tr>
            <td>Responsable</td>
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
            <td>Contacto</td>
            <td>
              <a href={`mailto:${KIVUK.email}`}>{KIVUK.email}</a>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Qué recogemos y para qué</h2>
      <p>
        <strong>Si rellenas el formulario de contacto:</strong> tu nombre, el
        nombre de tu negocio si lo indicas, el correo o teléfono que nos das y lo
        que escribas en el mensaje. Se usan para una sola cosa: responderte y, si
        hay interés por las dos partes, prepararte una propuesta.
      </p>
      <p>
        <strong>Si nos escribes por WhatsApp:</strong> tu número y el contenido de
        la conversación, con la misma finalidad. Ten en cuenta que esa
        conversación pasa por los servidores de WhatsApp (Meta), con sus propias
        condiciones.
      </p>
      <p>
        <strong>Si eres cliente y entras en el panel:</strong> los datos de tu
        cuenta y los de tu negocio necesarios para prestarte el servicio
        contratado. Ese tratamiento se rige por el contrato de servicio y por el
        contrato de encargado del tratamiento que lo acompaña, no por esta página.
      </p>

      <h2>Base legal</h2>
      <ul>
        <li>
          <strong>Tu consentimiento</strong> (art. 6.1.a RGPD) cuando rellenas el
          formulario o nos escribes: nos das los datos para que te respondamos.
        </li>
        <li>
          <strong>La ejecución de un contrato</strong> (art. 6.1.b) para lo que
          hace falta para prestarte el servicio si llegas a ser cliente.
        </li>
        <li>
          <strong>Una obligación legal</strong> (art. 6.1.c) para conservar la
          documentación fiscal y contable de las facturas emitidas.
        </li>
        <li>
          <strong>Interés legítimo</strong> (art. 6.1.f y art. 19 LOPDGDD) si te
          contactamos como empresa o profesional, en tus datos publicados de
          contacto y para ofrecerte servicios de tu propia actividad. En ese caso
          te identificamos siempre y te damos una forma clara de decir que no.
        </li>
      </ul>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Las consultas que no acaban en contrato se conservan mientras sigan
        teniendo sentido comercial y, como mucho, un año desde el último contacto;
        después se borran. Los datos de clientes se conservan durante la relación
        y, terminada esta, el tiempo que exijan las obligaciones legales —seis
        años para la documentación mercantil y cuatro para la fiscal—. Si nos
        pides que te borremos antes, lo hacemos con todo lo que la ley no nos
        obligue a guardar.
      </p>

      <h2>Con quién los compartimos</h2>
      <p>
        No vendemos datos ni los cedemos a nadie para que te haga publicidad. Sí
        usamos proveedores que los tratan por cuenta nuestra, todos con contrato
        de encargado del tratamiento y con garantías para las transferencias
        internacionales cuando las hay:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — base de datos, autenticación y
          almacenamiento de la plataforma.
        </li>
        <li>
          <strong>Contabo</strong> — el servidor donde se alojan la web, el panel
          y el motor de automatizaciones.
        </li>
        <li>
          <strong>Resend</strong> — envío de los correos (respuestas, avisos y
          facturas).
        </li>
        <li>
          <strong>Meta Platforms</strong> — WhatsApp Business, Instagram y
          Facebook, cuando la comunicación va por esos canales.
        </li>
        <li>
          <strong>Google</strong> — Calendar y Gmail, cuando el servicio
          contratado los usa.
        </li>
        <li>
          <strong>OpenRouter</strong> y <strong>OpenAI</strong> — los modelos de
          lenguaje que redactan las respuestas. Reciben el texto de la
          conversación para generar la contestación; no se usa para entrenar
          modelos.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Esta web <strong>no usa cookies de analítica ni de publicidad</strong>, ni
        rastreadores de terceros. Las únicas cookies que existen son las de sesión
        del panel de clientes: se crean al iniciar sesión, sirven para mantenerla
        abierta y desaparecen al cerrarla. Son técnicamente necesarias, así que no
        requieren consentimiento previo.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedirnos acceder a tus datos, rectificarlos, suprimirlos, limitar u
        oponerte a su tratamiento y llevártelos a otro sitio. Basta con
        escribirnos a <a href={`mailto:${KIVUK.email}`}>{KIVUK.email}</a>{" "}
        indicando qué quieres; respondemos en el plazo máximo de un mes y no
        cobramos por ello.
      </p>
      <p>
        Si crees que no te hemos atendido bien, puedes reclamar ante la Agencia
        Española de Protección de Datos (
        <a href="https://www.aepd.es">www.aepd.es</a>), que es la autoridad de
        control competente.
      </p>

      <h2>Seguridad</h2>
      <p>
        Los datos viajan cifrados, el acceso al panel exige contraseña propia por
        usuario y cada negocio está aislado de los demás a nivel de base de datos:
        un cliente no puede ver los datos de otro ni aunque lo intente. Los
        cambios en esta política se publican en esta misma página, con su fecha de
        actualización.
      </p>
    </PaginaLegal>
  );
}
