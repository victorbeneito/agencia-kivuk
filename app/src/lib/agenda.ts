/**
 * Lo común a la agenda: los días de la semana y el horario por defecto.
 *
 * Estaba duplicado en la pantalla de configuración y hace falta también en la
 * de trabajadores, así que vive aquí. Los valores tienen que seguir coincidiendo
 * con los del nodo `Calcular huecos` de n8n y con los del traspaso de la
 * migración 0014: son los tres sitios donde se decide qué horario tiene quien
 * no ha configurado ninguno.
 */

/** 1 = lunes ... 7 = domingo. Mismo criterio que n8n y que `staff_hours`. */
export const DIAS_SEMANA = [
  { valor: "1", etiqueta: "L", nombre: "Lunes" },
  { valor: "2", etiqueta: "M", nombre: "Martes" },
  { valor: "3", etiqueta: "X", nombre: "Miércoles" },
  { valor: "4", etiqueta: "J", nombre: "Jueves" },
  { valor: "5", etiqueta: "V", nombre: "Viernes" },
  { valor: "6", etiqueta: "S", nombre: "Sábado" },
  { valor: "7", etiqueta: "D", nombre: "Domingo" },
];

export const HORARIO_POR_DEFECTO = {
  dias_laborables: "1,2,3,4,5",
  manana_inicio: "09:00",
  manana_fin: "14:00",
  tarde_inicio: "16:00",
  tarde_fin: "20:00",
  duracion_min: "60",
  paso_min: "15",
  // Hasta cuándo se acepta una fecha concreta. Es distinto de los días de
  // huecos que ve la IA, que siguen siendo una semana: esa lista viaja en el
  // prompt de cada mensaje.
  dias_reserva: "30",
};

/** Un tramo de trabajo dentro de un día, tal como lo guarda `staff_hours`. */
export type Tramo = {
  dia: number;
  inicio: string;
  fin: string;
};

/** Postgres devuelve `time` como "09:00:00"; los <input type="time"> quieren "09:00". */
export function hhmm(hora: string): string {
  return String(hora).slice(0, 5);
}

/**
 * El horario que se le pone a un trabajador recién creado: el del negocio.
 *
 * Un trabajador sin ninguna fila en `staff_hours` no trabaja nunca, así que
 * crearlo con la tabla vacía sería crear a alguien invisible para el bot. Se
 * parte de lo que el negocio ya tenía configurado y luego se retoca.
 */
export function horarioInicial(config: Record<string, string> | null): Tramo[] {
  const cfg = config ?? {};

  const dias = (cfg.dias_laborables || HORARIO_POR_DEFECTO.dias_laborables)
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);

  const tramos: [string, string][] = [];
  if (cfg.manana_inicio && cfg.manana_fin)
    tramos.push([cfg.manana_inicio, cfg.manana_fin]);
  if (cfg.tarde_inicio && cfg.tarde_fin)
    tramos.push([cfg.tarde_inicio, cfg.tarde_fin]);
  if (!tramos.length)
    tramos.push(
      [HORARIO_POR_DEFECTO.manana_inicio, HORARIO_POR_DEFECTO.manana_fin],
      [HORARIO_POR_DEFECTO.tarde_inicio, HORARIO_POR_DEFECTO.tarde_fin]
    );

  return (dias.length ? dias : [1, 2, 3, 4, 5]).flatMap((dia) =>
    tramos.map(([inicio, fin]) => ({ dia, inicio, fin }))
  );
}
