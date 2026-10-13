-- La última búsqueda de inmuebles de cada persona, para que aceptar una oferta
-- no dependa de que la IA reescriba bien los criterios.
--
-- Cuando no hay nada, el bot ofrece lo más cercano («en otras zonas tengo 6,
-- ¿te los enseño?», «el más económico está en 240.000, ¿te los enseño?»). Si
-- la persona dice que sí, hay que repetir ESA búsqueda aflojando ESO. En las
-- pruebas del 07/10/2026 se dejaba a la IA volver a escribir los criterios, y
-- falló de las dos formas posibles: a un «sí» no rellenó la búsqueda (y volvió
-- a preguntar), y a «vale, enséñamelos» tras la oferta de chalets cambió los
-- tipos a todas las viviendas (y salieron pisos). Con la búsqueda anterior
-- guardada, la oferta aceptada la rehace el código.
--
-- Una fila por persona y negocio, que se pisa en cada búsqueda. Es estado de
-- la conversación, no historial: no hace falta guardar más que la última.
--
-- La escribe y la lee n8n con service_role. El panel no la usa; la agencia
-- puede leerla para depurar.

create table if not exists inmuebles_busquedas (
  client_id uuid not null references clients(id) on delete cascade,
  -- El teléfono de quien busca, como lo da WhatsApp. La conversación también
  -- valdría, pero el teléfono está a mano antes en el workflow.
  contacto text not null,
  filtros jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, contacto)
);

alter table inmuebles_busquedas enable row level security;

create policy "agency reads property searches"
  on inmuebles_busquedas for select
  using (es_agencia_del_cliente(client_id));
