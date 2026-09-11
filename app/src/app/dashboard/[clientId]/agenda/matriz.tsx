"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { guardarMatriz, type Resultado } from "./acciones";
import type { ServicioAgenda, TrabajadorBreve } from "./servicios";

/**
 * Quién hace qué, todo de una vez.
 *
 * Las casillas de dentro de cada servicio valen para retocar uno, pero montar
 * una clínica entera así es marcar cuarenta veces de una en una. Aquí una fila
 * asigna todos los trabajadores a un servicio, y una columna todos los
 * servicios a un trabajador, que son las dos formas en que se piensa esto:
 * "las mechas las hacen Bea y Sonia" y "Luis hace todo lo de fisioterapia".
 *
 * Nada se guarda hasta pulsar el botón: marcar y desmarcar mientras se decide
 * no puede ir escribiendo en la base.
 */
export function MatrizServicios({
  clientId,
  servicios,
  trabajadores,
}: {
  clientId: string;
  servicios: ServicioAgenda[];
  trabajadores: TrabajadorBreve[];
}) {
  const clave = (servicioId: string, staffId: string) => `${servicioId}|${staffId}`;

  const [marcadas, setMarcadas] = useState<Set<string>>(
    () =>
      new Set(
        servicios.flatMap((s) => s.trabajadores.map((t) => clave(s.id, t)))
      )
  );
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function alternar(claves: string[], marcar: boolean) {
    setMarcadas((previas) => {
      const siguiente = new Set(previas);
      for (const k of claves) {
        if (marcar) siguiente.add(k);
        else siguiente.delete(k);
      }
      return siguiente;
    });
    setResultado(null);
  }

  function guardar() {
    empezar(async () => {
      const pares = [...marcadas].map((k) => {
        const [servicioId, staffId] = k.split("|");
        return { servicioId, staffId };
      });
      setResultado(await guardarMatriz(clientId, pares));
    });
  }

  if (!servicios.length || !trabajadores.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Hacen falta al menos un trabajador y un servicio para repartir el
        trabajo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* La tabla puede crecer a lo ancho con muchos trabajadores; que se
          desplace ella y no la página entera. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background p-2 text-left font-medium">
                Servicio
              </th>
              {trabajadores.map((t) => {
                const suyas = servicios.map((s) => clave(s.id, t.id));
                const todas = suyas.every((k) => marcadas.has(k));

                return (
                  <th key={t.id} className="p-2 text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <span className={t.activo ? "" : "text-muted-foreground"}>
                        {t.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => alternar(suyas, !todas)}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {todas ? "ninguno" : "todos"}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {servicios.map((s) => {
              const suyas = trabajadores.map((t) => clave(s.id, t.id));
              const todas = suyas.every((k) => marcadas.has(k));
              const ninguna = suyas.every((k) => !marcadas.has(k));

              return (
                <tr key={s.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-background p-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => alternar(suyas, !todas)}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {todas ? "ninguno" : "todos"}
                      </button>
                      <span className={ninguna ? "text-destructive" : ""}>
                        {s.nombre}
                      </span>
                    </div>
                  </td>

                  {trabajadores.map((t) => {
                    const k = clave(s.id, t.id);
                    return (
                      <td key={t.id} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={marcadas.has(k)}
                          onChange={(e) => alternar([k], e.target.checked)}
                          aria-label={`${t.nombre} hace ${s.nombre}`}
                          className="size-4 accent-primary"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={guardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar reparto"}
        </Button>
        {resultado && (
          <span
            className={
              resultado.ok
                ? "text-sm text-muted-foreground"
                : "text-sm text-destructive"
            }
          >
            {resultado.mensaje}
          </span>
        )}
      </div>
    </div>
  );
}
