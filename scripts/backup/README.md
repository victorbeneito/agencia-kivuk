# Copias de seguridad de Supabase

El plan gratuito de Supabase **no hace backups automáticos**. Y ahí viven los
únicos datos que el VPS no puede recuperar por sí solo: clientes,
conversaciones, catálogo, base de conocimiento y la configuración de cada bot.
El servidor entero se vuelve a levantar desde git en una tarde; esto no.

Estos scripts corren en el VPS por cron y cubren las **dos** mitades del
problema, que son sistemas distintos:

| Script | Qué copia | Cuándo |
| --- | --- | --- |
| `backup-supabase.sh` | La base de datos (esquemas `public`, `auth` y `storage`) | 03:30 diario |
| `backup-storage.py` | Los archivos del bucket, que no salen en el volcado SQL | 03:45 diario |

La distinción importa: `pg_dump` respalda la tabla `storage.objects`, pero eso
son solo los metadatos. Con únicamente el volcado SQL, una restauración dejaría
las piezas de `content_items` apuntando a imágenes que ya no existen.

## Configuración

`backup-supabase.sh` necesita la cadena de conexión en `~/.supabase-backup.env`
del servidor (`chmod 600`, fuera del repo), en una sola línea:

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<clave>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Se saca del panel de Supabase → botón **Connect** → pestaña *Direct /
Connection string* → bloque **Session pooler**. Tiene que ser el *session*
pooler: `pg_dump` no funciona en modo transacción, y la conexión directa es
solo IPv6 en el plan gratuito.

La contraseña es la **de la base de datos**, no la de tu cuenta de Supabase. Se
resetea en `/settings/database` del proyecto (la URL directa funciona aunque el
apartado ya no salga en el menú). Conviene generarla solo con letras y números:
un `@`, `/` o `:` dentro rompe la URL.

`backup-storage.py` no necesita configuración aparte: lee `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` del `.env` de n8n.

## Cron instalado

```
30 3 * * * /home/kivuk/agencia-kivuk/scripts/backup/backup-supabase.sh >> /home/kivuk/backups/backup.log 2>&1
45 3 * * * /usr/bin/python3 /home/kivuk/agencia-kivuk/scripts/backup/backup-storage.py >> /home/kivuk/backups/backup.log 2>&1
```

Resultado en `~/backups/`: `db/` con los volcados SQL comprimidos (rotación de
7 días) y `storage/` con los archivos espejados. La descarga de Storage es
incremental — si el archivo ya está con el mismo tamaño, se salta.

## Comprobar que la copia sirve

Una copia que nadie ha abierto no es una copia:

```bash
~/agencia-kivuk/scripts/backup/verificar-backup.sh
```

Lista las tablas del último volcado con el número de filas de cada una. Si
`catalog_products` o `messages` salen a 0, algo va mal aunque el archivo exista
y pese lo suyo.

## Restaurar

```bash
gunzip -c ~/backups/db/supabase-FECHA.sql.gz \
  | docker run --rm -i postgres:17-alpine psql "$SUPABASE_DB_URL"
```

Los archivos de Storage se vuelven a subir desde `~/backups/storage/<bucket>/`
respetando las rutas, que son las mismas que guarda `storage.objects`.

## Limitación conocida

Las copias viven en el mismo VPS. Eso protege del error humano —un `DELETE` mal
dado, una migración que rompe algo—, que es con diferencia el caso más
frecuente. No protege de perder el servidor. Para cubrir eso haría falta
sincronizarlas a un tercer sitio (S3, Backblaze B2, otro servidor).
