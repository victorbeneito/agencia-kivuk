-- El avance de la bandeja cuando el último mensaje es un archivo sin texto.
--
-- Desde el 28/10/2026 una persona del negocio puede mandar fotos, vídeos y
-- documentos desde el panel (Cestería necesitaba enseñar una muestra a un
-- cliente). Una foto sin pie se guarda con el texto vacío, y el avance de la
-- lista, que sale del texto, se quedaba en blanco. Ahora dice lo que es, como
-- WhatsApp: «📷 Foto», «🎥 Vídeo», «🎤 Audio» o «📄 el-nombre.pdf».
--
-- Lo demás de la función es igual que en 0009.

create or replace function conversaciones_al_llegar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
         last_message_preview = case
           when coalesce(btrim(new.content), '') = '' and new.media_type is not null then
             case
               when new.media_type like 'image/%' then '📷 Foto'
               when new.media_type like 'video/%' then '🎥 Vídeo'
               when new.media_type like 'audio/%' then '🎤 Audio'
               else '📄 ' || coalesce(new.media_name, 'Documento')
             end
           else left(new.content, 140)
         end,
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
