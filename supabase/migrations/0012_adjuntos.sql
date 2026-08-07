-- Archivos que manda el cliente final por WhatsApp: fotos, notas de voz,
-- vídeos y documentos.
--
-- Hasta ahora un mensaje era solo texto. El bot sabe leer audio e imagen y los
-- convierte a texto, pero eso no basta cuando quien atiende es una persona: si
-- pide «mándame el PDF del pedido» o «grábame un vídeo de cómo llegó», tiene
-- que poder abrir el archivo, no leer un resumen.
--
-- Se guarda SIEMPRE, no solo cuando hay alguien atendiendo. Cuando el archivo
-- llega no se sabe todavía si alguien tomará el mando: la persona entra
-- después, y para entonces ya sería tarde.

alter table messages
  -- Ruta dentro del bucket, no una URL: el bucket es privado y el enlace se
  -- firma en el momento de mirarlo. Una URL guardada aquí o caducaría o sería
  -- pública para siempre.
  add column if not exists media_path text,
  add column if not exists media_type text,
  -- El nombre original solo lo manda Meta para documentos. En lo demás va nulo
  -- y el panel enseña el tipo.
  add column if not exists media_name text,
  add column if not exists media_size integer;

-- === El bucket ===
-- Privado, a diferencia de `contenido`. Aquel es público porque Instagram
-- descarga los medios por URL y no acepta otra cosa; esto son conversaciones
-- privadas de los clientes de un negocio y no puede estar al alcance de
-- cualquiera que acierte con el enlace.
insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

-- === Quién puede leerlos ===
-- La ruta es `{client_id}/{media_id}.{ext}`, así que la primera carpeta dice de
-- quién es el archivo. Sobre eso valen las mismas funciones que el resto de
-- tablas (migración 0008), y el aislamiento entre clientes es el mismo.
--
-- Escribir no lo puede hacer nadie: solo n8n con la `service_role`, que se
-- salta la RLS. Por eso aquí únicamente hay política de lectura.
create policy "adjuntos: la agencia y el cliente leen los suyos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'adjuntos'
    and array_length(storage.foldername(name), 1) >= 1
    -- El `~` comprueba que la carpeta sea un uuid antes de convertirla. Sin
    -- esto, un objeto con una ruta rara tumbaría la consulta entera en vez de
    -- quedar simplemente fuera del alcance.
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and (
      es_agencia_del_cliente(((storage.foldername(name))[1])::uuid)
      or es_usuario_del_cliente(((storage.foldername(name))[1])::uuid)
    )
  );
