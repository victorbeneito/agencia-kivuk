import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Check,
  MessageCircle,
  Moon,
  Sparkles,
} from "lucide-react";
import { ChatDemo } from "@/components/web/chat-demo";
import { ServiciosTabs } from "@/components/web/servicios-tabs";
import { FormularioContacto } from "./formulario-contacto";
import { KIVUK, enlaceContacto, hayWhatsApp } from "@/lib/web/kivuk";

/**
 * La landing de la agencia.
 *
 * Una sola página y una sola acción: abrir una conversación. Todo lo demás
 * —secciones, casos, precio— está para quitar el motivo por el que alguien no
 * la abriría, no para informar. Corta a propósito: un comerciante decide en dos
 * pantallas si esto le sirve.
 *
 * Es estática (no lee sesión ni base de datos), así que Next la sirve
 * pregenerada. Eso importa aquí más que en el panel: la mitad de las visitas van
 * a llegar desde el móvil y desde un anuncio.
 */

const CTA_PRINCIPAL = "Hola, he visto la web y me gustaría saber cómo funciona.";

// `absolute` para escapar de la plantilla `%s · Kivuk` del layout raíz: sin
// esto la portada se titula «Kivuk Agencia — ... · Kivuk», con la marca dos
// veces. Las páginas legales sí quieren la plantilla, y la conservan.
export const metadata: Metadata = {
  title: { absolute: "Kivuk Agencia — Tu WhatsApp contestado a todas horas" },
};

export default function Home() {
  return (
    <>
      <Hero />
      <Problema />
      <Servicios />
      <Relevo />
      <ComoFunciona />
      <Casos />
      <Precio />
      <Preguntas />
      <Contacto />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Dos manchas de color muy diluidas: dan profundidad sin meter una
          imagen de fondo que habría que cargar y que se vería mal recortada. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_36rem_at_78%_-10%,color-mix(in_srgb,var(--kivuk-azul)_55%,transparent),transparent),radial-gradient(44rem_30rem_at_-5%_15%,color-mix(in_srgb,var(--kivuk-arena)_35%,transparent),transparent)]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_auto] lg:gap-16 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-kivuk-azul-hondo/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-kivuk-azul-hondo uppercase">
            <Sparkles className="size-3.5" aria-hidden />
            IA para comercio local
          </p>

          <h1 className="mt-6 text-4xl leading-[1.1] font-bold text-balance text-kivuk-pizarra sm:text-5xl lg:text-[3.4rem]">
            Tu negocio contesta a todas horas. Tú, solo cuando quieras.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-kivuk-gris">
            Montamos un asistente con IA sobre el WhatsApp de tu negocio:
            responde con tu catálogo y tus precios, propone hueco en tu agenda y
            te avisa al móvil cuando alguien prefiere hablar con una persona. Sin
            aprender ninguna herramienta nueva.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={enlaceContacto(CTA_PRINCIPAL)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-kivuk-azul-hondo px-6 text-base font-semibold text-white shadow-lg shadow-kivuk-azul-hondo/20 transition-colors hover:bg-kivuk-pizarra"
            >
              <MessageCircle className="size-5" aria-hidden />
              {hayWhatsApp ? "Pruébalo por WhatsApp" : "Cuéntanos tu caso"}
            </a>
            <a
              href="#como-funciona"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-kivuk-pizarra/15 bg-white/70 px-6 text-base font-medium text-kivuk-pizarra transition-colors hover:bg-white"
            >
              Cómo funciona
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>

          {hayWhatsApp && (
            <p className="mt-4 text-sm text-kivuk-gris">
              Al otro lado te contesta el mismo asistente que montaríamos para
              ti. Esa es la demostración.
            </p>
          )}

          <ul className="mt-10 grid gap-3 text-sm text-kivuk-gris sm:grid-cols-3">
            {[
              "Sobre tu número de siempre",
              "Módulos sueltos: pagas lo que usas",
              "Tú entras al chat cuando quieras",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-kivuk-azul-hondo"
                  aria-hidden
                />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ChatDemo />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const DOLORES = [
  {
    icono: Moon,
    titulo: "Las 23:41",
    texto:
      "Alguien pregunta por un producto cuando la tienda lleva tres horas cerrada. Mañana ya lo ha comprado en otro sitio.",
  },
  {
    icono: MessageCircle,
    titulo: "La misma pregunta, otra vez",
    texto:
      "«¿A qué hora abrís?», «¿lo tenéis en azul?», «¿hacéis envíos?». Veinte veces al día, siempre las mismas cinco.",
  },
  {
    icono: CalendarCheck,
    titulo: "La cita que se cae",
    texto:
      "Se apuntó en un papel, nadie confirmó y no apareció. La hora se pierde igual que si no la hubieras vendido.",
  },
];

function Problema() {
  return (
    <Seccion>
      <Titulo
        eyebrow="El problema"
        titulo="No es que atiendas mal. Es que no puedes estar siempre"
        texto="Un negocio pequeño pierde ventas en los ratos en los que no hay nadie mirando el teléfono. No por falta de ganas: por falta de horas."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {DOLORES.map((d) => (
          <div
            key={d.titulo}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <d.icono className="size-6 text-kivuk-terracota" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-kivuk-pizarra">
              {d.titulo}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-kivuk-gris">{d.texto}</p>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

function Servicios() {
  return (
    <Seccion id="servicios" tono="claro">
      <Titulo
        eyebrow="Servicios"
        titulo="Cada canal, explicado y en marcha"
        texto="Casi todo el mundo empieza por el WhatsApp y añade el resto cuando ya se fía. Cada servicio se contrata por separado — mira cómo funciona cada uno."
      />

      <div className="mt-12">
        <ServiciosTabs />
      </div>

      <p className="mt-6 text-sm text-kivuk-gris">
        Todo esto vive en un panel único, instalable en el móvil: la bandeja de
        conversaciones, tus facturas y el contenido pendiente de aprobar.
      </p>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

function Relevo() {
  return (
    <Seccion>
      <div className="overflow-hidden rounded-3xl bg-kivuk-pizarra">
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-kivuk-arena uppercase">
              <BellRing className="size-3.5" aria-hidden />
              Lo que nos diferencia
            </p>
            <h2 className="mt-6 text-3xl leading-tight font-bold text-balance text-white sm:text-4xl">
              Cuando entras tú, el bot se calla
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#d7dfe4]/80">
              El miedo de todo el mundo es el mismo: que una máquina conteste una
              tontería a un cliente bueno. Por eso el relevo humano no es un
              añadido, es como está construido desde el principio.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#d7dfe4]/80">
              Si alguien pide hablar con una persona, te avisamos por tres sitios
              a la vez: en la pantalla, por correo y con una notificación en el
              móvil. Abres el chat, escribes tú y el asistente se aparta hasta
              que termines.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              ["Aviso triple", "En pantalla, por correo y en el móvil. Uno se pasa por alto; tres, no."],
              ["Mando manual", "Escribes desde el panel y le llega por WhatsApp como siempre. El cliente no nota el cambio."],
              ["Historial completo", "Todas las conversaciones guardadas y buscables, con audios, fotos y documentos."],
            ].map(([titulo, texto]) => (
              <li
                key={titulo}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-sm font-semibold text-white">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#d7dfe4]/70">
                  {texto}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

const PASOS = [
  {
    titulo: "Una llamada de veinte minutos",
    texto:
      "Nos cuentas qué te preguntan y qué te gustaría dejar de contestar a mano. Salimos de ahí con una propuesta escrita y un precio cerrado.",
  },
  {
    titulo: "Preparamos tu asistente",
    texto:
      "Cargamos tu catálogo, tus horarios y las respuestas que ya das cada día, y ajustamos su forma de hablar hasta que suena a tu negocio y no a un manual.",
  },
  {
    titulo: "Conectamos tu WhatsApp",
    texto:
      "Tu número de siempre o uno nuevo dedicado a esto: lo vemos en la primera llamada según cómo trabajes hoy. Nos ocupamos nosotros de la verificación y de la conexión.",
  },
  {
    titulo: "Una semana con nosotros mirando",
    texto:
      "Los primeros días leemos todas las conversaciones y corregimos lo que haga falta. Cuando el asistente responde como responderías tú, te lo dejamos.",
  },
];

function ComoFunciona() {
  return (
    <Seccion id="como-funciona" tono="claro">
      <Titulo
        eyebrow="Cómo funciona"
        titulo="De la llamada al asistente funcionando"
        texto="El trabajo lo hacemos nosotros. Lo único que necesitamos de ti es lo que ya sabes de memoria sobre tu negocio."
      />

      <ol className="mt-12 grid gap-5 md:grid-cols-2">
        {PASOS.map((p, i) => (
          <li
            key={p.titulo}
            className="relative rounded-2xl border border-border bg-card p-6 pl-16 shadow-sm"
          >
            <span className="absolute top-6 left-6 flex size-8 items-center justify-center rounded-full bg-kivuk-azul-hondo text-sm font-bold text-white">
              {i + 1}
            </span>
            <h3 className="text-lg font-semibold text-kivuk-pizarra">{p.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-kivuk-gris">{p.texto}</p>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-sm text-kivuk-gris">
        Lo nuestro son unos días. Lo que marca el ritmo de verdad es la
        verificación del negocio en Meta, que no depende de nosotros y conviene
        empezar cuanto antes.
      </p>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

function Casos() {
  return (
    <Seccion id="casos">
      <Titulo
        eyebrow="Dónde está funcionando"
        titulo="Así funciona ya, con un cliente real"
        texto="No enseñamos logotipos de empresas que no nos conocen. Esto es lo que hay, y es real."
      />

      <div className="mt-12 flex justify-center">
        <article className="w-full max-w-xl rounded-2xl border border-border bg-card p-7 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent">
              <Sparkles className="size-5 text-kivuk-azul-hondo" aria-hidden />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-kivuk-pizarra">
                Una cestería artesanal
              </h3>
              <p className="text-sm text-kivuk-gris">
                Comercio local · cliente en marcha
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-kivuk-gris">
            Producto hecho a mano, muchas preguntas por medida y por encargo, y
            una persona sola atendiendo. El asistente responde por el catálogo,
            propone día para pasar por el taller y avisa cuando la consulta
            merece una llamada.
          </p>
        </article>
      </div>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

const PRECIO = [
  {
    titulo: "Puesta en marcha",
    cuando: "Pago único, al principio",
    incluye: [
      "Alta y conexión de tu WhatsApp",
      "Carga de catálogo y horarios",
      "Redacción y ajuste del asistente",
      "Tu panel, con tus accesos",
    ],
  },
  {
    titulo: "Cuota mensual por módulo",
    cuando: "Cada mes, solo lo activo",
    incluye: [
      "Asistente de WhatsApp",
      "Agenda y confirmaciones",
      "Contenido para redes",
      "Soporte y ajustes del día a día",
    ],
    destacado: true,
  },
  {
    titulo: "Extras puntuales",
    cuando: "Cuando hacen falta",
    incluye: [
      "Campaña de temporada",
      "Lote extra de contenido",
      "Sesión de fotos de producto",
      "Módulos nuevos según crezcas",
    ],
  },
];

function Precio() {
  return (
    <Seccion id="precio" tono="claro">
      <Titulo
        eyebrow="Precio"
        titulo="Una puesta en marcha y una cuota por lo que uses"
        texto="No hay paquetes de tres colores en los que nadie encaja. Se contrata módulo a módulo, y lo que no usas no se paga."
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PRECIO.map((p) => (
          <div
            key={p.titulo}
            className={`rounded-2xl border p-7 shadow-sm ${
              p.destacado
                ? "border-kivuk-azul-hondo/30 bg-card ring-1 ring-kivuk-azul-hondo/20"
                : "border-border bg-card"
            }`}
          >
            <h3 className="text-lg font-semibold text-kivuk-pizarra">{p.titulo}</h3>
            <p className="mt-1 text-sm text-kivuk-gris">{p.cuando}</p>
            <ul className="mt-6 space-y-2.5">
              {p.incluye.map((linea) => (
                <li
                  key={linea}
                  className="flex items-start gap-2 text-sm text-kivuk-gris"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-kivuk-azul-hondo"
                    aria-hidden
                  />
                  {linea}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-kivuk-gris">
        La cifra depende de los módulos que contrates y del tamaño de tu
        catálogo, así que no la ponemos aquí para luego corregirla. Te la damos
        por escrito en la primera llamada, sin compromiso.
      </p>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

const PREGUNTAS = [
  {
    p: "¿Tengo que cambiar de número?",
    r: "No hace falta, pero conviene que sepas el efecto antes de decidir: llevar tu número actual a la API oficial de WhatsApp Business significa que deja de abrirse en la app del móvil — a partir de ahí se atiende desde tu panel, no desde el teléfono. Si prefieres conservar tu número tal cual está, montamos uno nuevo dedicado a esto. Lo hablamos en la primera llamada según cómo trabajes hoy.",
  },
  {
    p: "¿Y si el asistente se equivoca?",
    r: "Solo responde con lo que le has dado: tu catálogo, tus horarios, tus condiciones. Cuando le preguntan algo que no está ahí, no improvisa: lo dice y te pasa la conversación. Y tú puedes entrar en cualquier chat en cualquier momento, con el bot callándose al instante.",
  },
  {
    p: "¿Se nota que es un bot?",
    r: "Se nota que responde rápido y bien. No lo escondemos ni fingimos que hay una persona: el asistente habla con la forma de hablar de tu negocio, y lo que no sabe lo deriva. Esconderlo sería el camino más corto a enfadar a un cliente.",
  },
  {
    p: "¿De quién son las conversaciones y los datos?",
    r: "Tuyos. Están guardados en tu espacio de la plataforma, separados de los de cualquier otro negocio, y te los llevas si un día te vas. No vendemos ni cedemos datos a nadie: el detalle está en la política de privacidad.",
  },
  {
    p: "¿Cuánto se tarda en tenerlo funcionando?",
    r: "La parte que depende de nosotros son unos días. La que no es la verificación del negocio en Meta, que puede ir rápida o alargarse un par de semanas. Por eso la empezamos el primer día.",
  },
  {
    p: "¿Y si solo quiero el contenido de Instagram?",
    r: "También. Cada módulo se contrata suelto. Mucha gente empieza por el WhatsApp porque es lo que más duele, pero no hay ningún orden obligatorio.",
  },
];

function Preguntas() {
  return (
    <Seccion>
      <Titulo eyebrow="Dudas" titulo="Lo que nos preguntan siempre" />

      <div className="mx-auto mt-12 max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {PREGUNTAS.map((q) => (
          // <details> en vez de un acordeón con JavaScript: se abre igual, se
          // puede buscar con Ctrl+F aunque esté cerrado y lo lee un lector de
          // pantalla sin que haya que enseñarle nada.
          <details key={q.p} className="group p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-kivuk-pizarra marker:content-none">
              {q.p}
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-kivuk-azul-hondo transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-kivuk-gris">{q.r}</p>
          </details>
        ))}
      </div>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

function Contacto() {
  return (
    <Seccion id="contacto" tono="claro">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-xs font-semibold tracking-wider text-kivuk-terracota uppercase">
            Empezar
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-bold text-balance text-kivuk-pizarra sm:text-4xl">
            Cuéntanos qué te llega por WhatsApp
          </h2>
          <p className="mt-5 text-base leading-relaxed text-kivuk-gris">
            Con eso ya se ve si esto te sirve o no. La primera llamada son veinte
            minutos y no cuesta nada; si no lo tenemos claro, te lo decimos.
          </p>

          {hayWhatsApp && (
            <a
              href={enlaceContacto(CTA_PRINCIPAL)}
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-kivuk-azul-hondo px-6 text-base font-semibold text-white shadow-lg shadow-kivuk-azul-hondo/20 transition-colors hover:bg-kivuk-pizarra"
            >
              <MessageCircle className="size-5" aria-hidden />
              Escribir por WhatsApp
            </a>
          )}

          <p className="mt-8 text-sm text-kivuk-gris">
            O por correo:{" "}
            <a
              href={`mailto:${KIVUK.email}`}
              className="font-medium text-kivuk-azul-hondo underline underline-offset-2"
            >
              {KIVUK.email}
            </a>
          </p>
          <p className="mt-2 text-sm text-kivuk-gris">
            ¿Ya eres cliente?{" "}
            <Link
              href="/login"
              className="font-medium text-kivuk-azul-hondo underline underline-offset-2"
            >
              Entra en tu panel
            </Link>
            .
          </p>
        </div>

        <FormularioContacto />
      </div>
    </Seccion>
  );
}

/* ------------------------------------------------------------------ */

function Seccion({
  id,
  tono = "normal",
  children,
}: {
  id?: string;
  tono?: "normal" | "claro";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      // `scroll-mt` para que la cabecera pegajosa no tape el título cuando se
      // llega desde un ancla del menú.
      className={`scroll-mt-20 border-b border-border ${
        tono === "claro" ? "bg-secondary/40" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">{children}</div>
    </section>
  );
}

function Titulo({
  eyebrow,
  titulo,
  texto,
}: {
  eyebrow: string;
  titulo: string;
  texto?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold tracking-wider text-kivuk-terracota uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl leading-tight font-bold text-balance text-kivuk-pizarra sm:text-4xl">
        {titulo}
      </h2>
      {texto && (
        <p className="mt-5 text-base leading-relaxed text-kivuk-gris">{texto}</p>
      )}
    </div>
  );
}
