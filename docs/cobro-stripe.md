# Cobro de cuotas por domiciliación (Stripe + SEPA)

El contrato (5.3) dice que la primera cuota se paga por transferencia o Bizum y
las siguientes por **domiciliación bancaria**. La cuenta de Kivuk está en N26, y
N26 no permite emitir domiciliaciones: para girar recibos desde el banco hace
falta un identificador de acreedor SEPA y un banco que acepte remesas. Stripe
resuelve las dos cosas: hace de acreedor, guarda la orden que firma cada cliente,
pasa el cargo a su banco y transfiere lo cobrado a la cuenta de N26.

Migración: `supabase/migrations/0023_cobro_sepa_stripe.sql`.

## Las decisiones

**1. Stripe cobra, no factura.** Las facturas siguen saliendo del panel, con su
numeración correlativa, su PDF y su correo (`docs/facturacion.md`). Stripe solo
carga el total de una factura ya emitida. No se usan Stripe Billing ni sus
suscripciones: generarían sus propias facturas con su propia numeración, dos
documentos para el mismo cobro, y cobran un porcentaje extra por ello.

**2. No hay «remesa»; hay un cargo por factura.** El banco tradicional agrupa los
recibos del mes en un fichero. Stripe los manda uno a uno. Para el cliente es
igual (le llega un recibo al mes) y para Kivuk también (el dinero llega junto en
la transferencia de Stripe a N26).

**3. Una persona pulsa «Cobrar».** Igual que emitir: la generación del periodo es
automática, darle al botón no. Un cargo en la cuenta de un cliente que se acaba
de dar de baja es de las cosas que más cuesta arreglar.

**4. Primero se avisa, dos días después se cobra.** La norma SEPA exige avisar
del importe y la fecha antes de cargar: 14 días, salvo que se pacte otro plazo.
La orden que el cliente firma en Stripe pacta hasta 2 días. El aviso es el correo
con la factura, que en ese caso dice «se cargará en tu cuenta terminada en 1234 a
partir del…». El panel no deja cobrar una factura que no se ha enviado, ni antes
de que pasen esos dos días (`DIAS_AVISO_SEPA` en `lib/facturacion.ts`).

**5. El IBAN del cliente nunca pasa por el panel.** Lo escribe él en la página de
Stripe. Aquí solo se guardan los ids de Stripe y los cuatro últimos dígitos para
poder enseñar «cuenta terminada en 1234».

## Cómo va, de principio a fin

```
alta del cliente
  └─ «Crear enlace para firmar» (ficha → Facturación) ─► el cliente pone su IBAN en Stripe
       └─ webhook checkout.session.completed ─► ficha: mandato + ···· 1234, forma de pago = domiciliación

cada mes
  Generar facturas del periodo ─► revisar ─► Emitir ─► Enviar por correo (= aviso del cargo)
    └─ 2 días después: «Cobrar por domiciliación» ─► cargo en curso
         ├─ webhook payment_intent.succeeded      ─► factura pagada, sola
         ├─ webhook payment_intent.payment_failed ─► «el cargo ha fallado: sin fondos…»
         └─ hasta 8 semanas: charge.dispute.created ─► recibo devuelto, factura pendiente otra vez

Stripe ─► transferencia automática a N26
```

- **La firma.** Dos caminos: la agencia genera un enlace en la ficha del
  cliente (caduca a las 24 horas, pensado para la visita de alta o para
  mandarlo ese día por WhatsApp), o el cliente pulsa «Domiciliar mis recibos» en
  `/panel/facturas`, que no caduca porque crea la sesión al pulsar. Quien
  vuelve del enlace aterriza en `/domiciliacion`, una página pública de la web
  (grupo `(web)`): abrirlo en un móvil sin sesión y acabar en el login parecería un
  error.
- **El cargo.** Sale en estado *processing*. El banco del cliente tarda
  normalmente unos 5 días hábiles en pagarlo o rechazarlo, y hasta entonces la
  factura enseña «cargo lanzado el…».
- **La devolución.** Con SEPA el cliente puede pedir a su banco que le devuelva
  un recibo hasta 8 semanas después sin dar motivo (13 meses si dice que no lo
  autorizó). Stripe retira el dinero del saldo y cobra una comisión. La factura
  vuelve a pendiente y enseña el motivo.
- **La primera cuota.** El contrato dice que va por transferencia o Bizum. Si el
  cliente firma la domiciliación en la visita de alta, su ficha pasa a
  «domiciliación» y la primera factura saldría así: cambia la forma de pago en
  ese borrador antes de emitirlo.

Todo lo que cuenta Stripe llega a `app/src/app/api/stripe/webhook/route.ts`,
que comprueba la firma antes de leer nada y escribe con `service_role`. Los
manejadores se pueden repetir sin estropear nada: Stripe reintenta y a veces
entrega dos veces el mismo evento.

## Montar la cuenta de Stripe, paso a paso

Se hace una vez. Tardas una media hora, más lo que Stripe tarde en revisar la
cuenta.

### 1. Crear la cuenta

1. Entra en `https://dashboard.stripe.com/register` con el correo de la
   agencia. País: **España**.
2. Activa la verificación en dos pasos en cuanto entres (Configuración →
   Perfil). Esa cuenta mueve dinero.

### 2. Activar los pagos (datos del negocio)

En el Dashboard, «Activar pagos». Te pide, en este orden aproximado:

- **Tipo de empresa:** el que corresponda al titular de Kivuk. Si facturas como
  autónomo, «Persona física / empresario individual»; si hay sociedad, la
  sociedad. Tiene que coincidir con los datos fiscales de las facturas (NIF y
  razón social de `/dashboard/configuracion`).
- **Datos personales del titular:** nombre, DNI, fecha de nacimiento,
  dirección, teléfono. Es posible que pida una foto del DNI.
- **Sector y descripción:** servicios de software / marketing. Descripción
  corta: «Automatización con IA de WhatsApp, agenda y redes sociales para
  negocios locales, por cuota mensual».
- **Web:** `https://agenciakivuk.com` (Stripe la revisa: tiene aviso legal,
  privacidad y precios de partida, que es lo que miran).
- **Descriptor del extracto:** `KIVUK`. Es lo que verá el cliente en su banco.
- **Cuenta bancaria para las transferencias:** el **IBAN de N26**. El titular de
  la cuenta de N26 tiene que ser el mismo que el de la cuenta de Stripe.

### 3. Activar el adeudo directo SEPA

Configuración → **Métodos de pago** → busca **Adeudo directo SEPA** (SEPA
Direct Debit) → Activar. En algunas cuentas nuevas Stripe lo revisa antes de
dejarlo usar; si aparece como «en revisión», hay que esperar a que lo apruebe.

### 4. Correos a los clientes

Configuración → **Correos electrónicos de clientes**: comprueba que están
activados los de **adeudo directo SEPA** (confirmación de la orden y aviso de
cargo). La página de vuelta le dice al cliente que recibirá una copia de la
orden, así que tienen que estar encendidos.

### 5. Imagen de marca

Configuración → **Marca**: el logo de Kivuk y el color terracota (`#B45831`). Es
lo que ve el cliente en la página donde pone su IBAN; una página con el logo
genera más confianza que una genérica.

### 6. Calendario de transferencias a N26

Configuración → **Transferencias** (payouts): automático. Diario o semanal, a tu
gusto; con pocos clientes, **semanal** deja menos movimientos sueltos en N26. La
primera transferencia de una cuenta nueva suele tardar más de lo normal (una o
dos semanas): es la retención inicial de Stripe, no un fallo.

### 7. Probar en modo de prueba (en local)

Stripe tiene un **modo de prueba** con claves que empiezan por `sk_test_`: todo
funciona igual pero no se mueve dinero. Se prueba ahí antes de tocar nada real.

1. Developers → **Claves de API** (con el modo de prueba activado) → copia la
   clave secreta a `app/.env.local` como `STRIPE_SECRET_KEY`.
2. Instala la Stripe CLI (`https://docs.stripe.com/stripe-cli`) y ejecuta:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Imprime un `whsec_…`: va a `STRIPE_WEBHOOK_SECRET` en `app/.env.local`.
   Déjala abierta mientras pruebas: es la que trae los eventos al portátil.
3. `npm run dev`, entra en la ficha de un cliente de pruebas → Facturación →
   «Crear enlace para firmar», ábrelo y usa un IBAN de prueba:
   `AT611904300234573201` (el cargo sale bien). La lista completa, con los que
   fallan y los que se devuelven, está en `https://docs.stripe.com/testing`,
   apartado SEPA.
4. Emite una factura con forma de pago «Domiciliación», envíala, y para no
   esperar dos días cambia a mano `enviada_at` en Supabase a hace tres días.
   Pulsa «Cobrar por domiciliación». En modo de prueba se confirma en unos
   minutos, y la factura debe pasar a **Pagada** sola.

### 8. Pasar a real (producción)

1. Aplica la migración `0023_cobro_sepa_stripe.sql` en Supabase, como las
   anteriores (editor SQL).
2. Developers → **Webhooks** → Añadir endpoint (modo real):
   - URL: `https://panel.agenciakivuk.com/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `mandate.updated`,
     `payment_intent.succeeded`, `payment_intent.payment_failed`,
     `charge.dispute.created`.
   - Copia el **secreto de firma** (`whsec_…`).
3. Developers → **Claves de API** (modo real). Mejor que la clave secreta
   completa, crea una **clave restringida** con solo estos permisos: Customers
   (escritura), Checkout Sessions (escritura), PaymentIntents (escritura),
   SetupIntents (lectura), PaymentMethods (lectura). Si un día se filtra, no
   sirve para mover el saldo ni tocar la cuenta.
4. En el servidor, en `~/agencia-kivuk/n8n/.env`:
   ```
   STRIPE_SECRET_KEY=rk_live_…   (o sk_live_…)
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```
5. Despliega: `git pull && dc up -d --build`. El `--build` hace falta porque
   cambia el código del panel.
6. Comprueba en la ficha de un cliente que la tarjeta «Domiciliación bancaria»
   ya no dice «Falta configurar Stripe». Haz la primera firma real contigo
   mismo o con un cliente de confianza antes de mandársela a nadie.

### Trampas que ya han salido

- **El modo de prueba y el real son dos cuentas distintas a efectos de
  configuración.** Activar el adeudo SEPA, crear el webhook o copiar su
  secreto en modo de prueba no vale para el real. Si el panel dice «The
  payment method type provided: sepa_debit is invalid», el SEPA no está activo
  en el modo de la clave que usa el servidor. Si el webhook da 400 «Firma no
  válida» con eventos reales, el `whsec_` es el del otro modo.
- **Un nombre de variable mal escrito no da error, da vacío.** Con
  `STRIP_WEBHOOK_SECRET` en el `.env`, el panel decía «Stripe sin configurar».
  Para comprobarlo sin enseñar las claves:
  `dc exec panel printenv | grep STRIPE | cut -c1-30`.
- **La página de Stripe tarda en cargar** la primera vez: se queda unos
  segundos en un esqueleto gris. Hay que esperar, no está colgada.

## Lo que cuesta

Stripe no tiene cuota fija. Cobra una comisión fija por cada adeudo SEPA
cobrado y una más alta por cada recibo devuelto o fallido. Las cifras cambian:
míralas en `https://stripe.com/es/pricing` (apartado «Adeudos directos SEPA»)
antes de fijar precios. Con cuotas de decenas de euros, la comisión por recibo es
mucho menor que la de una tarjeta.

Stripe emite cada mes una factura con sus comisiones: descárgala del Dashboard y
pásasela a la gestoría con el resto de gastos. Es un proveedor irlandés (Stripe
Payments Europe), y la gestoría sabrá cómo declararlo.

## Lo que falta

- **Cobro sin botón.** Hoy se pulsa «Cobrar» factura a factura. Cuando haya
  bastantes clientes, un workflow de n8n que el día 3 lance los cargos de las
  facturas enviadas hace dos días.
- **Aviso a la agencia de un fallo o una devolución.** Se ve en la factura, y
  Stripe manda su propio correo de las devoluciones, pero el panel no avisa. Un
  correo por Resend desde el webhook sería suficiente.
- **Reintento automático** de un cargo fallido por falta de fondos. Hoy se
  relanza a mano, después de hablar con el cliente.
