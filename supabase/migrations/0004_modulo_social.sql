-- El módulo `instagram` pasa a llamarse `social`.
--
-- Instagram, Facebook y TikTok comparten catálogo, identidad de marca y piezas
-- generadas; lo único que cambia entre ellas son las credenciales de
-- publicación, que caben dentro del mismo `config`. Un módulo por red
-- obligaría a duplicar el catálogo y el tono tres veces.
--
-- `content_items.channel` ya distinguía la red desde el primer día, así que la
-- pieza sabe dónde se publica sin necesidad de que el módulo lo diga.

do $$
declare
  nombre_check text;
begin
  -- El nombre del check lo genera Postgres y puede variar entre instalaciones,
  -- así que se busca en vez de darlo por supuesto.
  select con.conname into nombre_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'client_modules'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%module%';

  if nombre_check is not null then
    execute format('alter table client_modules drop constraint %I', nombre_check);
  end if;
end $$;

update client_modules set module = 'social' where module = 'instagram';

alter table client_modules
  add constraint client_modules_module_check
  check (module in ('whatsapp', 'voice', 'calendar', 'email', 'social'));
