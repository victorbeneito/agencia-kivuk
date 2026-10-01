"use client";

import { useState, useTransition } from "react";
import { Copy, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fecha } from "@/lib/facturacion";
import {
  enlaceDomiciliacion,
  type ResultadoEnlace,
} from "@/app/dashboard/facturacion/cobro";

/**
 * Si el cliente tiene firmada la domiciliación, y si no, el enlace para que la
 * firme.
 *
 * El IBAN no lo escribe nadie en este panel: lo pone el cliente en la página de
 * Stripe, que es quien guarda la orden firmada. Aquí solo se ve el resultado.
 */
export function Domiciliacion({
  clientId,
  ultimos4,
  firmadoAt,
  configurado,
}: {
  clientId: string;
  ultimos4: string | null;
  firmadoAt: string | null;
  configurado: boolean;
}) {
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoEnlace | null>(null);
  const [copiado, setCopiado] = useState(false);

  const firmada = Boolean(ultimos4 && firmadoAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domiciliación bancaria</CardTitle>
        <CardDescription>
          {firmada
            ? `Firmada el ${fecha(firmadoAt)}. Las cuotas se cargan en la cuenta terminada en ${ultimos4}.`
            : "Sin domiciliar. El cliente pone su IBAN y firma la orden en una página de Stripe; no hace falta papel."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!configurado ? (
          <p className="text-sm text-destructive">
            Falta configurar Stripe: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en el
            entorno del panel (ver docs/cobro-stripe.md).
          </p>
        ) : (
          <>
            <Button
              variant={firmada ? "outline" : "default"}
              className="w-fit"
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setCopiado(false);
                  setResultado(await enlaceDomiciliacion(clientId));
                })
              }
            >
              <Landmark className="size-4" />
              {pendiente
                ? "Creando…"
                : firmada
                  ? "Enlace para cambiar de cuenta"
                  : "Crear enlace para firmar"}
            </Button>

            {resultado?.url && (
              <div className="flex flex-wrap items-center gap-2">
                <Input readOnly value={resultado.url} className="min-w-[260px] flex-1" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(resultado.url!);
                    setCopiado(true);
                  }}
                >
                  <Copy className="size-4" />
                  {copiado ? "Copiado" : "Copiar"}
                </Button>
              </div>
            )}

            {resultado && (
              <p
                className={`text-sm ${resultado.ok ? "text-muted-foreground" : "text-destructive"}`}
              >
                {resultado.mensaje}
                {resultado.ok &&
                  " Ábrelo con él delante o mándaselo hoy por WhatsApp. Si caduca, puede firmar desde su panel, en Facturas."}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
