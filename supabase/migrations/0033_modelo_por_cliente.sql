-- El modelo de IA de cada cliente.
--
-- Hasta ahora todos los bots usaban gpt-4o, escrito en el workflow. Cestería
-- pidió respuestas más cortas y claras (27/10/2026): sus clientes no entendían
-- respuestas correctas pero largas y volvían a preguntar lo mismo. Con el mismo
-- prompt y sus conversaciones reales, gpt-5.5 contesta la mitad de largo, sin
-- coletillas y siguiendo mejor sus reglas; gpt-4o no lo conseguía ni con el
-- prompt reescrito.
--
-- Cambiar de modelo cambia cómo responde un bot, así que se hace cliente a
-- cliente, después de probar su prompt con el modelo nuevo, y no todos a la
-- vez. Vacío = gpt-4o (lo decide «Preparar contexto» en el workflow).
--
-- No hace falta política nueva: agent_configs ya tiene RLS y el cliente final
-- no la lee (regla del client_user).

alter table agent_configs add column if not exists modelo text;

comment on column agent_configs.modelo is
  'Modelo de OpenAI del bot de este cliente (p. ej. gpt-5.5). Vacío: gpt-4o.';
