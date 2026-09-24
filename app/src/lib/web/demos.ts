/**
 * Las demos sectoriales que se pueden probar desde la web.
 *
 * Son negocios inventados —ni el salón, ni la clínica, ni la gente— montados
 * sobre la misma plataforma que un cliente de pago: su catálogo, su agenda y su
 * base de conocimiento. Cada uno tiene su propia línea de WhatsApp, así que
 * quien las prueba habla con el bot del sector que le interesa y no con un
 * selector.
 *
 * El primer mensaje va escrito en el enlace: la persona solo tiene que pulsar
 * enviar. Sin él, la mitad de la gente escribe «hola» y se queda esperando, que
 * es la peor primera impresión posible de un asistente que sabe de precios.
 *
 * Los números y el detalle de cada demo, en `docs/demo-*.md`. El QR de cada una
 * se genera con `scripts/generar-qr-demos.js`, que escribe los mismos archivos
 * que se sirven aquí.
 */
export type Demo = {
  slug: string;
  sector: string;
  negocio: string;
  /** Lo que el visitante va a preguntar, ya escrito en el enlace. */
  pregunta: string;
  /** Lo que el bot sabe hacer, para que se pruebe eso y no otra cosa. */
  sabe: string;
  numero: string;
  visible: string;
  qr: string;
};

export const DEMOS: Demo[] = [
  {
    slug: "peluqueria",
    sector: "Peluquería",
    negocio: "Peluquería Mechas",
    pregunta: "Hola, ¿cuánto cuestan unas mechas?",
    sabe: "Precios, duraciones, quién hace qué y cita con hueco real.",
    numero: "34623790343",
    visible: "+34 623 79 03 43",
    qr: "/demos/qr-peluqueria.png",
  },
  {
    slug: "dental",
    sector: "Clínica dental",
    negocio: "Clínica Dental Muelas",
    pregunta: "Hola, me duele una muela, ¿me podéis ver?",
    sabe: "Tratamientos, urgencias del día y cita con el dentista que toca.",
    numero: "34613013979",
    visible: "+34 613 01 39 79",
    qr: "/demos/qr-dental.png",
  },
  {
    slug: "fisio",
    sector: "Fisioterapia",
    negocio: "Clínica Fisioterapia Masajes",
    pregunta: "Hola, tengo una contractura, ¿tenéis hueco esta semana?",
    sabe: "Sesiones, bonos y cita con quien lleva cada especialidad.",
    numero: "34623814787",
    visible: "+34 623 81 47 87",
    qr: "/demos/qr-fisio.png",
  },
];

/** El enlace que abre WhatsApp con la primera pregunta ya escrita. */
export function enlaceDemo(demo: Demo): string {
  return `https://wa.me/${demo.numero}?text=${encodeURIComponent(demo.pregunta)}`;
}
