-- Cobro de las cuotas por domiciliación SEPA, con Stripe como pasarela.
--
-- El contrato (5.3) dice que la primera cuota se paga por transferencia o Bizum
-- y las siguientes por domiciliación. Domiciliar por el banco pide un
-- identificador de acreedor SEPA y montar remesas; la cuenta de Kivuk (N26) no
-- lo ofrece. Stripe hace de acreedor: guarda el mandato que firma el cliente,
-- pasa el cargo a su banco y transfiere lo cobrado a la cuenta de Kivuk.
--
-- Lo que Stripe **no** hace aquí es facturar. Las facturas siguen saliendo del
-- panel con su numeración correlativa (0013); Stripe solo cobra el total de una
-- factura ya emitida. Si Stripe Billing generase las suyas, habría dos series de
-- facturas para el mismo cobro, y la de Stripe no sabe nada de la nuestra.
--
-- Nada de lo que se guarda aquí es secreto: un id de Stripe no sirve de nada sin
-- la clave secreta, que vive en el entorno del panel. Por eso las columnas van
-- en tablas que el cliente puede leer (le interesa ver que su recibo está
-- domiciliado y en qué cuenta), y no hace falta tabla aparte.

-- === El mandato, en la ficha fiscal del cliente ===

alter table client_billing_profiles
  add column if not exists stripe_customer_id text,
  -- El método de pago SEPA (la cuenta) y el mandato que la autoriza. Se
  -- rellenan cuando el cliente firma en la página de Stripe, y se vacían si el
  -- mandato deja de valer (lo revoca en su banco, cierra la cuenta).
  add column if not exists sepa_payment_method_id text,
  add column if not exists sepa_mandate_id text,
  -- Para enseñar «cuenta terminada en 1234» sin guardar el IBAN entero, que ya
  -- lo tiene Stripe y aquí no se necesita.
  add column if not exists sepa_ultimos4 text,
  add column if not exists sepa_firmado_at timestamptz;

-- === El cargo, en la factura ===
--
-- `estado` sigue siendo el de 0013 (emitida, enviada, pagada…). El cobro lleva
-- su propio estado porque va por otro reloj: un adeudo SEPA tarda días en
-- confirmarse, puede fallar, y hasta ocho semanas después el cliente puede
-- devolverlo desde su banco sin dar motivo.
--
--   null      → no se ha intentado cobrar por domiciliación
--   en_curso  → cargo lanzado, esperando a que el banco del cliente responda
--   cobrado   → el banco lo ha pagado (la factura pasa a `pagada`)
--   fallido   → el banco lo ha rechazado (sin fondos, cuenta cerrada…)
--   devuelto  → estaba cobrado y el cliente lo ha devuelto (la factura vuelve
--               a pendiente)

alter table invoices
  add column if not exists cobro_estado text
    check (cobro_estado in ('en_curso', 'cobrado', 'fallido', 'devuelto')),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists cobro_iniciado_at timestamptz,
  -- El motivo, tal como lo cuenta Stripe, para poder decírselo al cliente.
  add column if not exists cobro_error text;

-- El webhook de Stripe localiza la factura por el id del cargo cuando llega una
-- devolución, que no trae los metadatos del cargo original.
create unique index if not exists invoices_stripe_payment_intent_idx
  on invoices (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
