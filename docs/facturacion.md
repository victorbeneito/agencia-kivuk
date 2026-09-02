# Facturación — cómo funciona y por qué está así

El panel ya sabía todo del trabajo que se hace para el cliente y nada del
dinero. Este módulo cierra ese hueco: datos fiscales de las dos partes, catálogo
de servicios, qué tiene contratado cada cliente, y las facturas que salen de
ahí — con su PDF y su envío por correo.

Migración: `supabase/migrations/0013_facturacion.sql`.

## Las tres decisiones que lo condicionan todo

**1. El borrador no lleva número.** En España la numeración tiene que ser
correlativa y sin huecos. Si se numerase al crear, cada borrador descartado
dejaría un agujero que hay que justificar ante Hacienda. El número se asigna al
pulsar «Emitir», y desde ese momento la factura no se edita: si está mal, se
anula y se hace otra. La anulada se queda a la vista con su número — un hueco en
la serie es peor que una factura tachada.

**2. La factura emitida guarda una copia de los datos fiscales** de emisor y
receptor (columnas `emisor` y `receptor`, jsonb). Si el cliente se muda o cambia
de razón social, sus facturas viejas siguen enseñando lo que tenían el día que
se emitieron. Son documentos, no vistas de la ficha actual.

**3. El número lo reparte la base de datos, no el código.** La función
`siguiente_numero_factura(agency_id, fecha)` hace `select ... for update` sobre
la fila de ajustes: bloquea, lee, incrementa y suelta. Dos pestañas emitiendo a
la vez no pueden llevarse el mismo número. Un «leer, sumar uno, escribir» desde
Next.js sí lo haría, y una numeración repetida es justo lo que no se perdona.
Formato: `F2026-0001` — serie, ejercicio y contador, que se reinicia solo al
cambiar de año.

## Las tablas

| Tabla | Qué guarda | Quién la ve |
| --- | --- | --- |
| `agency_billing_settings` | Datos fiscales de la agencia, IBAN, serie y contador, IVA/IRPF por defecto, texto del pie | Solo la agencia |
| `client_billing_profiles` | Datos fiscales del cliente, correo de facturación, forma de pago, excepciones de IVA/IRPF | Agencia (escribe) y cliente (lee) |
| `services` | Catálogo de la agencia: qué vende y a qué precio de tarifa | Solo la agencia |
| `client_services` | Lo que un cliente concreto tiene contratado, con su precio acordado y cuándo toca facturarlo | Agencia (escribe) y cliente (lee) |
| `invoices` | La factura: estado, fechas, tipos, totales y la copia de los datos fiscales | Agencia; el cliente ve las suyas **no** borrador |
| `invoice_items` | Las líneas | Igual que la factura |

El catálogo y lo contratado están separados a propósito: **subir la tarifa no
puede cambiar retroactivamente lo que paga quien ya firmó**. Al contratar, el
nombre y el precio se copian, y desde ahí el contrato vive por su cuenta.

Un tipo de IVA y uno de IRPF **por factura**, no por línea. Una agencia factura
servicios, todos al mismo tipo; permitir tipos mezclados complicaría la pantalla
y el PDF a cambio de un caso que aquí no se da.

## El ciclo de vida

```
borrador  ──emitir──►  emitida  ──enviar──►  enviada  ──cobrar──►  pagada
   │                      │                    │
 borrar                   └──────anular────────┘
```

- **borrador** — sin número, se edita entero. Sale de la generación del periodo
  o del botón «Factura suelta». Se puede borrar sin dejar rastro.
- **emitida** — número asignado, datos congelados. Ya no se toca.
- **enviada** — se mandó por correo con el PDF adjunto. La marca la pone el
  propio envío.
- **pagada** — con su fecha y, si se quiere, la referencia del cobro.
- **anulada** — el número se queda ocupado. Es la única forma de deshacer una
  emisión.

«Vencida» no es un estado guardado: es una factura emitida o enviada cuyo
vencimiento ya pasó. Se calcula al pintar. Guardarlo obligaría a un proceso
nocturno que repasara la tabla, y podría quedarse desfasado.

## Facturación recurrente

Cada servicio contratado lleva una `proxima_factura`. El botón **«Generar
facturas del periodo»** busca todo lo que tenga esa fecha vencida, agrupa por
cliente, crea **un borrador por cliente** con sus líneas y adelanta el contador
según la recurrencia (mensual, trimestral, anual; los de pago único se quedan a
null porque ya están facturados).

Deja borradores, no facturas emitidas. **La generación es automática; darle a
emitir, no.** Entre una cosa y otra hay una persona comprobando que el mes es el
que es y que nadie se ha dado de baja. Si se pulsa dos veces el mismo día, no
duplica: antes de crear, mira si ya hay una factura viva para ese mismo periodo
y cliente.

## El PDF

Se genera con `pdf-lib` (`app/src/lib/factura-pdf.ts`), dibujando el documento a
mano. Sin Puppeteer ni conversores de HTML: son binarios de cientos de megas que
en Vercel hay que empaquetar aparte y que fallan de formas raras. Son cuatro
cajas y una tabla, y así funciona igual en local, en Vercel y en el VPS sin
instalar nada. El archivo pesa unos 5 KB porque las fuentes estándar no se
incrustan.

El precio de esas fuentes es su codificación, WinAnsi (Latin-1 ampliado): los
acentos y el € entran, pero un carácter fuera de esa tabla haría reventar la
generación entera. Por eso todo el texto pasa antes por `limpiar()`, que
sustituye lo que puede y descarta lo que no.

Se sirve en `/api/facturas/[facturaId]/pdf`, **una sola ruta para la agencia y
para el cliente**: quién puede verla no lo decide el código, lo deciden las
políticas de RLS. Si la consulta no devuelve fila, es que no le corresponde.

## El envío por correo

`enviarFactura()` manda el correo por Resend **desde el panel**, no por n8n. Es
la diferencia con los avisos del cliente: allí quien escribe es su negocio con
sus credenciales, aquí quien escribe es la agencia con su dominio. La clave vive
en el entorno del panel:

```
RESEND_API_KEY=
FACTURAS_REMITENTE="Kivuk Agencia <facturacion@agenciakivuk.com>"
```

El correo lleva el importe, las fechas, el IBAN y el PDF adjunto; si la factura
tiene `enlace_pago` (un Payment Link de Stripe pegado a mano), añade un botón de
pagar. Sin esas dos variables el botón avisa en pantalla en vez de fallar en
silencio.

## Qué ve el cliente

En `/panel/facturas`, solo lectura y solo las emitidas — el filtro lo hace la
RLS, no la pantalla. Puede descargar el PDF y, si la hay, seguir el URL de pago.
La sección solo aparece cuando ya tiene alguna factura: un cliente recién dado
de alta no ve una pantalla vacía.

## Lo que falta

- **Cobro automático.** Hoy el enlace de pago se pega a mano. Con Stripe
  Billing: crear el `Customer` y la suscripción desde la ficha del cliente, y un
  webhook que marque la factura como pagada al recibir el `invoice.paid`.
- **Cron de la generación mensual.** El botón está; falta un workflow de n8n que
  lo llame el día 1 y avise si un cliente se queda sin borrador.
- **Aviso de vencidas.** Un recordatorio automático al cliente a los X días de
  pasarse la fecha, y a la agencia el resumen.
- **Verifactu.** Desde 2026 el software de facturación en España tiene que
  cumplir el reglamento antifraude (registro encadenado con hash, código QR en
  la factura, envío a la AEAT). Mientras se facture a través de una gestoría que
  emita las oficiales, esto es un control interno; si se pasa a emitir de
  verdad desde aquí, hay que implementarlo antes.
