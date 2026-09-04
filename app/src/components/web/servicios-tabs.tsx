"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Images,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { ChatDemo } from "./chat-demo";
import { DemoAgenda } from "./demo-agenda";
import { DemoRedes } from "./demo-redes";
import { DemoVoz } from "./demo-voz";
import { DemoCorreo } from "./demo-correo";
import { BadgeEnDesarrollo } from "./badge-en-desarrollo";

const SERVICIOS = [
  {
    id: "whatsapp",
    nombre: "WhatsApp",
    icono: MessageCircle,
    enDesarrollo: false,
    titulo: "Tu WhatsApp, atendido de verdad",
    texto:
      "El canal donde ya te escriben tus clientes. El asistente responde con tu catálogo, tus precios y tus horarios reales, y sabe cuándo callarse.",
    puntos: [
      "Responde con tu catálogo y tus condiciones, no con genéricos",
      "Se calla en cuanto tú entras a escribir",
      "Guarda cada conversación, con fotos y audios incluidos",
    ],
    Demo: ChatDemo,
  },
  {
    id: "agenda",
    nombre: "Agenda y citas",
    icono: CalendarCheck,
    enDesarrollo: false,
    titulo: "La cita se agenda sola",
    texto:
      "En cuanto alguien quiere reservar, el asistente propone hueco libre, lo crea en tu Google Calendar y manda la confirmación por correo. Sin cuaderno, sin dobles reservas.",
    puntos: [
      "Mira tu calendario real, no una agenda aparte",
      "Confirma por correo con la hora exacta",
      "Avisa si alguien cancela o cambia de hora",
    ],
    Demo: DemoAgenda,
  },
  {
    id: "redes",
    nombre: "Redes sociales",
    icono: Images,
    enDesarrollo: false,
    titulo: "De tu catálogo a la publicación",
    texto:
      "Cada pieza sale de tu catálogo con copy escrito por IA. Tú la apruebas desde el móvil antes de que salga; nada se publica a tus espaldas.",
    puntos: [
      "Compuesta con tus fotos de producto reales, nunca inventadas",
      "Tú das el visto bueno en el panel antes de publicar",
      "Instagram y Facebook, con el mismo catálogo",
    ],
    Demo: DemoRedes,
  },
  {
    id: "voz",
    nombre: "Voz",
    icono: Phone,
    enDesarrollo: true,
    titulo: "El mismo asistente, por teléfono",
    texto:
      "Estamos llevando la misma lógica del WhatsApp a las llamadas: contestar, agendar y avisar cuando toca una persona. Es el canal en el que estamos trabajando ahora.",
    puntos: [
      "Misma agenda, mismo criterio, distinto canal",
      "Pensado para quien todavía recibe más llamadas que mensajes",
      "Sin fecha cerrada: te avisamos cuando esté listo para probarlo",
    ],
    Demo: DemoVoz,
  },
  {
    id: "correo",
    nombre: "Correo",
    icono: Mail,
    enDesarrollo: true,
    titulo: "Tu bandeja, ya revisada",
    texto:
      "La idea: que la IA lea tu correo antes que tú, resuma lo importante, marque lo urgente y te deje una respuesta lista para enviar o corregir en dos clics.",
    puntos: [
      "Resumen de lo que ha entrado, no un correo más que leer",
      "Marca lo importante para que no se pierda entre el resto",
      "Sugiere la respuesta; tú decides si la envías tal cual",
    ],
    Demo: DemoCorreo,
  },
];

/**
 * Los servicios, en pestañas.
 *
 * Cliente y no servidor porque necesita recordar cuál está abierta —lo mínimo
 * que exige una pestaña—, pero el coste es pequeño: la única lógica es un
 * `useState` con el id activo. Los tres primeros servicios son reales y en
 * producción; Voz y Correo llevan `enDesarrollo: true` porque no lo son
 * todavía, y esa marca es la que dibuja `BadgeEnDesarrollo` tanto en la
 * pestaña como en el panel — cuando alguno pase a producción, el cambio es
 * borrar esa única línea aquí arriba, no rehacer la sección.
 */
export function ServiciosTabs() {
  const [activoId, setActivoId] = useState(SERVICIOS[0].id);
  const servicio = SERVICIOS.find((s) => s.id === activoId) ?? SERVICIOS[0];
  const Demo = servicio.Demo;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Servicios de Kivuk"
        className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SERVICIOS.map((s) => {
          const activo = s.id === activoId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={activo}
              aria-controls={`panel-${s.id}`}
              onClick={() => setActivoId(s.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                activo
                  ? "border-kivuk-azul-hondo bg-kivuk-azul-hondo text-white"
                  : "border-border bg-card text-kivuk-gris hover:border-kivuk-azul-hondo/40 hover:text-kivuk-pizarra"
              }`}
            >
              <s.icono className="size-4" aria-hidden />
              {s.nombre}
              {s.enDesarrollo && !activo && (
                <span
                  className="size-1.5 rounded-full bg-kivuk-terracota"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        key={servicio.id}
        role="tabpanel"
        id={`panel-${servicio.id}`}
        aria-labelledby={`tab-${servicio.id}`}
        className="mt-8 grid gap-10 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-14"
      >
        <div>
          {servicio.enDesarrollo && (
            <BadgeEnDesarrollo className="mb-4" />
          )}
          <h3 className="text-2xl font-bold text-balance text-kivuk-pizarra">
            {servicio.titulo}
          </h3>
          <p className="mt-4 text-base leading-relaxed text-kivuk-gris">
            {servicio.texto}
          </p>
          <ul className="mt-6 space-y-2.5">
            {servicio.puntos.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-kivuk-gris">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-kivuk-azul-hondo"
                  aria-hidden
                />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center">
          <Demo />
        </div>
      </div>
    </div>
  );
}
