/**
 * Leer y escribir la lista de servicios como CSV.
 *
 * Sirve para dos cosas: montar de golpe los cuarenta servicios de una clínica
 * en vez de rellenar cuarenta formularios, y llevarse la lista de un cliente
 * para reaprovecharla en el siguiente del mismo sector.
 *
 * Está escrito para tragar lo que salga de Excel o de Google Sheets sin pedirle
 * a nadie que prepare el fichero "bien":
 *
 *   - **El separador se detecta solo.** El Excel en español exporta CSV con
 *     punto y coma, no con coma. Obligar a la coma sería garantizar que el
 *     primer fichero real no se lee.
 *   - **Los alias no hay que entrecomillarlos.** Si una fila trae más columnas
 *     de las esperadas, las de sobra son alias. Así `Mechas,120,mechitas,tinte`
 *     funciona igual que `Mechas,120,"mechitas,tinte"`.
 *   - **La cabecera es opcional.** Si la primera fila ya lleva un número en la
 *     segunda columna, es un dato y no un título.
 *
 * No admite campos entrecomillados con saltos de línea dentro. Es la única
 * cosa de CSV que se queda fuera, y no aparece en una lista de servicios.
 */

export type FilaServicio = {
  /** Número de línea en el fichero, para poder señalar el error. */
  linea: number;
  nombre: string;
  duracionMin: number;
  alias: string[];
  /** Si viene, la fila no se importa. */
  error?: string;
};

const DELIMITADORES = [";", "\t", ","];

/** Cuenta un carácter fuera de comillas: dentro no separa nada. */
function contarFuera(linea: string, caracter: string): number {
  let dentro = false;
  let total = 0;
  for (const c of linea) {
    if (c === '"') dentro = !dentro;
    else if (!dentro && c === caracter) total++;
  }
  return total;
}

function detectarDelimitador(cabecera: string): string {
  let mejor = ",";
  let max = 0;
  for (const d of DELIMITADORES) {
    const n = contarFuera(cabecera, d);
    if (n > max) {
      max = n;
      mejor = d;
    }
  }
  return mejor;
}

function partirLinea(linea: string, delimitador: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];

    if (entreComillas) {
      // Dos comillas seguidas dentro de un campo son una comilla literal.
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
      continue;
    }

    if (c === '"') entreComillas = true;
    else if (c === delimitador) {
      campos.push(actual);
      actual = "";
    } else actual += c;
  }

  campos.push(actual);
  return campos.map((c) => c.trim());
}

/** Para comparar nombres: sin tildes, sin mayúsculas y sin espacios de sobra. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parsearServicios(texto: string): FilaServicio[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lineas.length) return [];

  const delimitador = detectarDelimitador(lineas[0]);

  // ¿La primera línea es cabecera? Lo es salvo que su segunda columna ya sea
  // un número, en cuyo caso estamos leyendo un servicio y su duración.
  const primera = partirLinea(lineas[0], delimitador);
  const hayCabecera = !/^\d+$/.test(primera[1] ?? "");

  const filas: FilaServicio[] = [];
  const vistos = new Set<string>();

  lineas.forEach((linea, indice) => {
    if (hayCabecera && indice === 0) return;

    const numeroLinea = indice + 1;
    const campos = partirLinea(linea, delimitador);
    const nombre = campos[0] ?? "";

    // Las columnas que sobran son alias, y dentro de una sola columna valen
    // como separadores los tres caracteres que la gente usa.
    const alias = campos
      .slice(2)
      .flatMap((c) => c.split(/[|;,]/))
      .map((a) => a.trim())
      .filter(Boolean);

    const base = { linea: numeroLinea, nombre, alias };

    if (!nombre) {
      filas.push({ ...base, duracionMin: 0, error: "Sin nombre de servicio." });
      return;
    }

    const duracion = Number((campos[1] ?? "").replace(",", "."));
    if (!Number.isFinite(duracion) || !Number.isInteger(duracion)) {
      filas.push({
        ...base,
        duracionMin: 0,
        error: `Duración «${campos[1] ?? ""}» no es un número de minutos.`,
      });
      return;
    }
    if (duracion <= 0 || duracion > 600) {
      filas.push({
        ...base,
        duracionMin: duracion,
        error: "La duración tiene que estar entre 1 y 600 minutos.",
      });
      return;
    }

    const clave = normalizarNombre(nombre);
    if (vistos.has(clave)) {
      filas.push({
        ...base,
        duracionMin: duracion,
        error: "Repetido en el fichero.",
      });
      return;
    }
    vistos.add(clave);

    filas.push({ ...base, duracionMin: duracion });
  });

  return filas;
}

/** El CSV que se descarga. Se relee con `parsearServicios` sin perder nada. */
export function serializarServicios(
  servicios: { nombre: string; duracionMin: number; alias: string[] }[]
): string {
  const escapar = (v: string) =>
    /[",;\t\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

  return [
    "nombre,duracion_min,alias",
    ...servicios.map((s) =>
      [escapar(s.nombre), String(s.duracionMin), escapar(s.alias.join("|"))].join(",")
    ),
  ].join("\n");
}
