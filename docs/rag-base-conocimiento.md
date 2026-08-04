# Base de conocimiento con RAG (multi-cliente)

Documento de trabajo para Claude Code. Objetivo: que el bot de WhatsApp de cada cliente responda con información **veraz** de su negocio (productos, precios, envíos, devoluciones, horarios), sin inventarse nada, y sin que cada cliente necesite código propio.

Leer antes: `CLAUDE.md` y `docs/architecture.md`.

## El problema que resuelve

Hoy `agent_configs.knowledge_base` es un campo de texto que se mete entero en el prompt. Eso se rompe en cuanto el negocio tiene un catálogo real:

- No cabe en la ventana de contexto.
- Se pagan todos esos tokens **en cada mensaje** de cada conversación.
- La IA se despista: con 40 páginas de contexto, la respuesta a "¿cuánto tarda el envío?" se contamina con información de otros temas.

La solución es RAG: trocear el conocimiento, guardarlo como vectores, y en cada mensaje recuperar **solo los 4-5 fragmentos relevantes** para lo que el usuario acaba de preguntar. Supabase ya trae `pgvector`, así que no hace falta ningún servicio nuevo.

## Lección aprendida de agente-hogar (importante)

En `agente-hogar` (proyecto aparte, para la tienda propia elhogardetusuenos.com) la base de conocimiento **no es scraping en bruto**: son documentos **curados**, cada uno con título, categoría y un texto denso y autocontenido. Por ejemplo:

- `Devoluciones y cambios — política según tipo de producto` (categoría: devolucion)
- `Envíos — plazos, transportistas, seguimiento y coste` (categoría: envio)
- `Cómo leer la tarifa de precios de estores lisos` (categoría: producto)
- `Contacto, atención al cliente y horario` (categoría: empresa)

Esa decisión es la que hace que las respuestas sean buenas, y hay que replicarla aquí. El scraping crudo de una web produce fragmentos con menús, migas de pan y texto de marketing que ensucian la recuperación. Un documento escrito a propósito para responder una duda concreta se recupera mejor y produce respuestas mucho más precisas.

**Criterio: el scraping sirve para el catálogo (datos estructurados), los documentos curados para las políticas y el "cómo funciona esto".**

## Arquitectura

Tres fuentes de conocimiento, cada una con su papel:

1. **`catalog_products`** (ya existe, la alimenta el workflow `catalogo-ingesta.json`): productos con nombre, precio, URL, descripción. Es la fuente **estructurada y exacta**. Los precios salen de aquí, nunca de un texto libre.
2. **`knowledge_documents`** (nuevo): documentos curados por categoría, al estilo de agente-hogar. Políticas de envío, devoluciones, horarios, cómo interpretar tarifas, FAQs.
3. **`agent_configs.system_prompt`** (ya existe): personalidad y reglas de comportamiento del bot. Se mantiene como está.

Los documentos se trocean en `knowledge_chunks`, cada trozo con su embedding. La búsqueda **siempre filtra por `client_id`** — ese filtro es la frontera entre clientes y no es opcional.

## Migración de base de datos

Crear `supabase/migrations/0006_rag.sql`:

```sql
-- pgvector viene disponible en Supabase, solo hay que activarlo.
create extension if not exists vector;

-- Documentos curados: la unidad que el usuario del panel crea y edita.
create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  title text not null,
  category text not null default 'faq',
  content text not null,
  source_url text,                      -- si vino de una página concreta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trozos indexados: lo que realmente se busca. Se regeneran al guardar el documento.
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  document_id uuid references knowledge_documents(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),               -- text-embedding-3-small
  created_at timestamptz not null default now()
);

-- Índice vectorial. ivfflat va bien hasta decenas de miles de trozos.
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_client_idx
  on knowledge_chunks (client_id);

alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

-- Mismas políticas de acceso que el resto de tablas por cliente
-- (copiar el patrón de client_modules en 0001_init.sql).

-- Función de búsqueda. El filtro por client_id va DENTRO de la función,
-- para que sea imposible consultar sin él por descuido desde n8n.
create or replace function match_knowledge(
  p_client_id uuid,
  p_embedding vector(1536),
  p_match_count int default 5,
  p_min_similarity float default 0.25
)
returns table (
  content text,
  title text,
  category text,
  source_url text,
  similarity float
)
language sql stable
as $$
  select
    kc.content,
    kd.title,
    kd.category,
    kd.source_url,
    1 - (kc.embedding <=> p_embedding) as similarity
  from knowledge_chunks kc
  join knowledge_documents kd on kd.id = kc.document_id
  where kc.client_id = p_client_id
    and 1 - (kc.embedding <=> p_embedding) > p_min_similarity
  order by kc.embedding <=> p_embedding
  limit p_match_count;
$$;
```

## Troceado (chunking)

Regla práctica, sin complicarse:

- Si el documento ocupa menos de ~1.200 caracteres, va **entero** como un solo trozo. La mayoría de documentos curados caben aquí, y partirlos solo empeora la recuperación.
- Si es más largo, partir por párrafos hasta llenar ~1.000 caracteres por trozo, con ~150 de solapamiento para no cortar una frase a la mitad.
- Anteponer siempre el título del documento al texto del trozo antes de generar el embedding: `"[Envíos — plazos y coste]\n\n<texto>"`. Ayuda mucho a que el trozo se recupere por su tema.

## Embeddings

- Modelo: **`text-embedding-3-small`** de OpenAI (1536 dimensiones). Es barato (céntimos por catálogo entero) y suficiente. Usar el mismo modelo para indexar y para consultar — si se cambia, hay que reindexar todo.
- Se generan en dos momentos: al guardar un documento desde el panel, y al ingerir el catálogo.
- Endpoint: `POST https://api.openai.com/v1/embeddings` con `{ "model": "text-embedding-3-small", "input": "<texto>" }`.

## Cambios en el workflow de n8n (`whatsapp-bot.json`)

El flujo actual es:

```
Webhook1 → Extraer mensaje → Buscar cliente Whatsapp → Buscar prompt del cliente
→ Consultar agenda → Buscar o crear conversación → Cargar historial
→ Preparar contexto → Llamar a OpenAI → ...
```

Insertar **dos nodos justo antes de "Preparar contexto"**:

1. **"Generar embedding de la pregunta"** (HTTP Request):
   - `POST https://api.openai.com/v1/embeddings`
   - Body: `{ "model": "text-embedding-3-small", "input": {{ JSON.stringify($('Extraer mensaje').item.json.message_text) }} }`

2. **"Buscar conocimiento"** (HTTP Request a la función RPC de Supabase):
   - `POST {{ $env.SUPABASE_URL }}/rest/v1/rpc/match_knowledge`
   - Cabeceras: las mismas `apikey` / `Authorization` que ya usan los demás nodos.
   - Body:
     ```
     {
       "p_client_id": {{ JSON.stringify($('Buscar cliente Whatsapp').item.json.client_id) }},
       "p_embedding": {{ JSON.stringify($json.data[0].embedding) }},
       "p_match_count": 5
     }
     ```

Después, en **"Preparar contexto"**, añadir los fragmentos recuperados al mensaje de sistema, con una instrucción de anclaje:

```
INFORMACIÓN DEL NEGOCIO (usa solo esto para datos concretos):
<aquí los fragmentos recuperados, cada uno con su título>

Reglas:
- Responde únicamente con la información de arriba cuando te pregunten por
  precios, plazos, políticas o características.
- Si la información no está ahí, dilo con naturalidad y ofrece contacto humano.
  Nunca inventes precios, plazos ni condiciones.
- Si citas un producto, incluye su URL si aparece en la información.
```

Esa última parte es la que garantiza la veracidad que buscas: sin ella el modelo rellena huecos por su cuenta, que es exactamente lo que no queremos en una tienda real.

## Cambios en el panel (Next.js)

Nueva pestaña **"Conocimiento"** dentro de la ficha del cliente (junto a Resumen / Contenido / Conversaciones / Configuración), replicando lo que ya funciona en agente-hogar:

- Lista de documentos con título, categoría y un extracto del contenido.
- Formulario para añadir/editar documento: título, categoría (`empresa`, `envio`, `devolucion`, `producto`, `faq`, `pago`), contenido (textarea grande), URL de origen opcional.
- Botón eliminar.
- Al guardar: server action que escribe el documento, borra sus chunks anteriores, genera los nuevos con sus embeddings y los inserta. **El reindexado tiene que ser automático al guardar** — si depende de un botón aparte, tarde o temprano habrá documentos editados sin reindexar y el bot responderá con datos viejos.
- Indicador visible de cuántos trozos indexados tiene cada documento, para detectar de un vistazo si algo falló.

Mantener `agent_configs.knowledge_base` como está por ahora (compatibilidad); una vez la pestaña nueva funcione, se puede migrar su contenido a documentos y dejar de inyectarlo en el prompt.

## Precios: el punto donde más se falla

Los precios cambian y son justo el dato donde una alucinación hace daño real. Dos reglas:

1. Los precios vivos salen de **`catalog_products`** (que se resincroniza con el workflow de ingesta), no de documentos escritos a mano.
2. Los documentos curados explican **cómo funciona la tarifa** (ej. "los estores lisos tienen dos versiones con precios propios; el precio es por unidad confeccionada a la medida indicada, no por metro cuadrado"), no los números concretos.

Si el bot necesita dar un precio concreto, lo ideal es una búsqueda adicional contra `catalog_products` por nombre de producto, en paralelo a la búsqueda vectorial. Se puede dejar para una segunda iteración, pero conviene tenerlo en mente al diseñar "Preparar contexto".

## Plan de trabajo (en este orden)

1. **Migración `0006_rag.sql`** con las dos tablas, índices, RLS y la función `match_knowledge`. Probar la función desde el SQL Editor con un embedding de mentira para ver que devuelve filas.
2. **Pestaña "Conocimiento" en el panel**: CRUD de documentos + generación automática de embeddings al guardar. Probar creando 3-4 documentos del cliente real.
3. **Dos nodos nuevos en `whatsapp-bot.json`** + actualizar "Preparar contexto" con los fragmentos y las reglas de anclaje. Publicar y probar por WhatsApp.
4. **Batería de preguntas de prueba**: escribir 15-20 preguntas reales que hará un cliente ("¿hacéis envíos a Canarias?", "¿puedo devolver un estor a medida?", "¿cuánto tarda?") y comprobar una por una que la respuesta es correcta y que **dice que no lo sabe** cuando toca. Este paso no es opcional: es la única forma de saber si el RAG funciona antes de ponerlo delante de clientes reales.
5. **Cargar el conocimiento completo** del cliente real, documento a documento.

## Notas para Claude Code

- El filtro por `client_id` en toda consulta de conocimiento es la frontera entre clientes. Cualquier consulta que se escriba sin él es un fallo de aislamiento, no un detalle de rendimiento.
- No romper el flujo actual del workflow: los nodos nuevos se insertan, no se sustituye lo que ya funciona (agenda, historial, respuesta).
- Si la búsqueda no devuelve nada (cliente sin conocimiento cargado todavía), el bot debe seguir respondiendo con su `system_prompt` normal, no fallar.
- Mismo modelo de embeddings para indexar y consultar, siempre.
