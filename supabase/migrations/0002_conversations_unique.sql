-- El workflow de n8n hace un upsert sobre conversations con
-- on_conflict=client_id,channel,external_contact_id para reutilizar el hilo
-- de un mismo contacto en lugar de crear una conversación por mensaje.
-- Ese índice único ya se creó a mano en Supabase durante la Fase 2, pero
-- faltaba en las migraciones del repo: sin él, una base nueva rompería el bot.

do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'conversations'
      and i.indisunique
      and i.indnatts = 3
  ) then
    create unique index conversations_client_channel_contact_key
      on public.conversations (client_id, channel, external_contact_id);
  end if;
end $$;
