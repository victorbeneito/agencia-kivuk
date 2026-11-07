-- El avance de la bandeja de un archivo, sin lo que el flujo escribe para el bot.
--
-- 0034 ponía «📷 Foto» cuando un archivo llegaba sin texto. Pero los que manda
-- el contacto casi nunca llegan sin texto: el flujo guarda lo que el bot
-- necesita saber, «[un video]» o «[un documento]» si no trae pie, y «En la foto
-- se ve: …» con la descripción de una foto. En la lista salía eso: «En la foto
-- se ve: Se observa una estructura de madera…» (Cestería, 07/11/2026).
--
-- Ahora un archivo sale como en WhatsApp: «📷 Foto», «🎥 Vídeo», «🎤 Audio» o
-- «📄 el-nombre.pdf», y si traía pie, el pie detrás («📷 Mira esta grieta»).
-- Las notas de voz se quedan con su transcripción, que es lo que interesa leer.
--
-- Lo demás de la función es igual que en 0009.

create or replace function conversaciones_al_llegar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text := btrim(coalesce(new.content, ''));
  v_icono text;
begin
  if new.media_type is not null then
    -- Fuera las marcas para el bot: «[un video]» entero, y la descripción de
    -- la foto con lo que venga detrás.
    if v_texto ~ '^\[[^]]{1,40}\]$' then
      v_texto := '';
    end if;
    v_texto := btrim(regexp_replace(v_texto, '\s*En la foto se ve:.*$', ''));

    v_icono := case
      when new.media_type like 'image/%' then '📷'
      when new.media_type like 'video/%' then '🎥'
      when new.media_type like 'audio/%' then '🎤'
      else '📄'
    end;

    v_texto := case
      when v_texto <> '' then v_icono || ' ' || v_texto
      when new.media_type like 'image/%' then '📷 Foto'
      when new.media_type like 'video/%' then '🎥 Vídeo'
      when new.media_type like 'audio/%' then '🎤 Audio'
      else '📄 ' || coalesce(new.media_name, 'Documento')
    end;
  end if;

  update conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
         last_message_preview = left(v_texto, 140),
         last_inbound_at = case
           when new.sender = 'contact'
             then greatest(coalesce(last_inbound_at, new.created_at), new.created_at)
           else last_inbound_at
         end,
         -- Solo cuenta como no leído lo que llega de fuera. Lo que responde el
         -- bot o una persona del negocio ya lo ha visto quien lo mandó.
         unread_count = case
           when new.sender = 'contact' then unread_count + 1
           else unread_count
         end
   where id = new.conversation_id;

  return new;
end;
$$;
