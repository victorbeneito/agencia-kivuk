"use client";

import { useState, useTransition } from "react";
import { Copy, Landmark, Mail, MessageCircle } from "lucide-react";

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
  enviarEnlaceDomiciliacion,
  type ResultadoEnlace,
} from "@/app/dashboard/facturacion/cobro";

/**
 * Si el cliente tiene firmada la domiciliación, y si no, cómo hacerle llegar
 * el enlace para que la firme: por correo, por WhatsApp o copiándolo.
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
  const [enlace, setEnlace] = useState<ResultadoEnlace | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const firmada = Boolean(ultimos4 && firmadoAt);

  const textoWhatsapp = (url: string) =>
    `Hola, para domiciliar las cuotas de Kivuk solo tienes que abrir este enlace, poner tu IBAN y aceptar. Es una página segura de Stripe, nuestra pasarela de cobro: ${url}`;

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
            <div className="flex flex-wrap gap-2">
              <Button
                variant={firmada ? "outline" : "default"}
                disabled={pendiente}
                onClick={() =>
                  empezar(async () => {
                    setAviso(null);
                    setAviso(await enviarEnlaceDomiciliacion(clientId));
                  })
                }
              >
                <Mail className="size-4" />
                {pendiente ? "Un momento…" : firmada ? "Enviar enlace para cambiar de cuenta" : "Enviar enlace por correo"}
              </Button>
              <Button
                variant="outline"
                disabled={pendiente}
                onClick={() =>
                  empezar(async () => {
                    setAviso(null);
                    setCopiado(false);
                    const r = await enlaceDomiciliacion(clientId);
                    setEnlace(r);
                    if (!r.ok) setAviso(r);
                  })
                }
              >
                <Landmark className="size-4" />
                Ver enlace
              </Button>
            </div>

            {enlace?.url && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input readOnly value={enlace.url} className="min-w-[260px] flex-1" />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(enlace.url!);
                      setCopiado(true);
                    }}
                  >
                    <Copy className="size-4" />
                    {copiado ? "Copiado" : "Copiar"}
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a
                        href={`https://wa.me/${enlace.whatsapp ?? ""}?text=${encodeURIComponent(textoWhatsapp(enlace.url))}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {enlace.mensaje} Puedes abrirlo con él delante o mandárselo.
                  {!enlace.whatsapp &&
                    " Sin teléfono en la ficha, WhatsApp te pedirá elegir a quién mandarlo."}
                </p>
              </div>
            )}

            {aviso && (
              <p className={`text-sm ${aviso.ok ? "text-emerald-700" : "text-destructive"}`}>
                {aviso.mensaje}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
