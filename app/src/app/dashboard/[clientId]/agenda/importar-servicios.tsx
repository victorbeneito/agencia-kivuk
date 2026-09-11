"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { serializarServicios } from "@/lib/agenda-csv";
import {
  importarServicios,
  previsualizarImportacion,
  type Plan,
  type Resultado,
} from "./acciones";
import type { ServicioAgenda } from "./servicios";

const EJEMPLO = `nombre,duracion_min,alias
Corte de caballero,30,corte,corte hombre
Corte y mechas,120,mechitas,reflejos
Lavado,15`;

/**
 * Cargar la lista de servicios de golpe, y llevársela a otro cliente.
 *
 * Montar una clínica con cuarenta servicios a base de formularios es una tarde
 * perdida, y la lista de una clínica dental se parece muchísimo a la de la
 * siguiente. Con esto se prepara una vez en una hoja de cálculo y se reutiliza.
 *
 * Nunca escribe sin enseñar antes qué va a hacer: el fichero lo ha preparado
 * una persona a mano y siempre trae una línea rara.
 */
export function ImportarServicios({
  clientId,
  servicios,
  nombreCliente,
}: {
  clientId: string;
  servicios: ServicioAgenda[];
  nombreCliente: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, empezar] = useTransition();
  const ficheroRef = useRef<HTMLInputElement>(null);

  function descargar() {
    const csv = serializarServicios(
      servicios.map((s) => ({
        nombre: s.nombre,
        duracionMin: s.duracionMin,
        alias: s.alias,
      }))
    );

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `servicios-${nombreCliente
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  function cambiarTexto(valor: string) {
    setTexto(valor);
    // El plan deja de valer en cuanto se toca el texto del que salió.
    setPlan(null);
    setResultado(null);
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setAbierto(!abierto)}>
          <Upload className="size-4" />
          Importar desde fichero
        </Button>

        {servicios.length > 0 && (
          <Button variant="ghost" size="sm" onClick={descargar}>
            <Download className="size-4" />
            Descargar los actuales
          </Button>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">
            <p>
              Una línea por servicio: <strong>nombre, minutos</strong> y, si
              quieres, los alias con los que la gente lo pide. Vale lo que
              exporte Excel o Sheets, con comas o con punto y coma.
            </p>
          </div>

          <Textarea
            rows={7}
            value={texto}
            onChange={(e) => cambiarTexto(e.target.value)}
            placeholder={EJEMPLO}
            className="font-mono text-xs"
          />

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={ficheroRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const fichero = e.target.files?.[0];
                if (fichero) cambiarTexto(await fichero.text());
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => ficheroRef.current?.click()}
            >
              Elegir fichero…
            </Button>

            <Button
              size="sm"
              disabled={!texto.trim() || pendiente}
              onClick={() =>
                empezar(async () =>
                  setPlan(await previsualizarImportacion(clientId, texto))
                )
              }
            >
              Ver qué va a pasar
            </Button>
          </div>

          {plan && (
            <div className="flex flex-col gap-3">
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">Servicio</th>
                      <th className="p-2 text-left font-medium">Duración</th>
                      <th className="p-2 text-left font-medium">Alias</th>
                      <th className="p-2 text-left font-medium">Qué pasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.filas.map((f) => (
                      <tr key={f.linea} className="border-t">
                        <td className="p-2">{f.nombre || "—"}</td>
                        <td className="p-2 tabular-nums">
                          {f.accion === "error" ? "—" : `${f.duracionMin} min`}
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {f.alias.join(", ") || "—"}
                        </td>
                        <td className="p-2">
                          {f.accion === "crear" && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Se crea
                            </span>
                          )}
                          {f.accion === "actualizar" && (
                            <span className="text-muted-foreground">
                              Ya existe: se actualiza
                            </span>
                          )}
                          {f.accion === "error" && (
                            <span className="text-destructive">
                              Línea {f.linea}: {f.detalle}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={pendiente || (!plan.crear && !plan.actualizar)}
                  onClick={() =>
                    empezar(async () => {
                      const r = await importarServicios(clientId, texto);
                      setResultado(r);
                      if (r.ok) {
                        setPlan(null);
                        setTexto("");
                        setAbierto(false);
                      }
                    })
                  }
                >
                  {pendiente
                    ? "Importando…"
                    : `Importar ${plan.crear + plan.actualizar} servicios`}
                </Button>

                {plan.errores > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {plan.errores}{" "}
                    {plan.errores === 1 ? "línea se descarta" : "líneas se descartan"}
                    ; el resto entra igual.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <p
          className={
            resultado.ok
              ? "text-sm text-muted-foreground"
              : "text-sm text-destructive"
          }
        >
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
