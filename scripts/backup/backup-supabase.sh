#!/usr/bin/env bash
#
# Copia de seguridad nocturna de la base de datos de Supabase.
#
# Por que existe: el plan gratuito de Supabase no hace backups automaticos, y
# ahi viven los datos que el VPS no puede recuperar si se pierden (clientes,
# conversaciones, catalogo, configuracion de cada bot).
#
# Que NO cubre: los archivos de Supabase Storage (bucket `contenido`). Son un
# sistema aparte y pg_dump no los ve; las filas de content_items apuntarian a
# imagenes inexistentes. Eso se respalda por separado.
#
# La cadena de conexion vive en ~/.supabase-backup.env (chmod 600), fuera del
# repo. Formato del archivo, una sola linea:
#     SUPABASE_DB_URL=postgresql://usuario:clave@host:5432/postgres
#
# Restaurar un volcado:
#     gunzip -c ~/backups/db/supabase-2026-08-05.sql.gz \
#       | docker run --rm -i postgres:17-alpine psql "$SUPABASE_DB_URL"

set -uo pipefail

CONF=~/.supabase-backup.env
DESTINO=~/backups/db
RETENCION_DIAS=7
IMAGEN=postgres:17-alpine

marca() { echo "[$(date '+%F %T')] $*"; }

if [ ! -f "$CONF" ]; then
  marca "ERROR: falta $CONF con la cadena de conexion. No se hace nada."
  exit 1
fi

# Se lee con grep+cut y NO con `source`: la contrasena puede llevar caracteres
# que bash interpretaria (`&` lanza a segundo plano, `$` expande, `;` corta la
# orden). Asignar desde una sustitucion de orden no sufre nada de eso.
SUPABASE_DB_URL=$(grep '^SUPABASE_DB_URL=' "$CONF" | head -1 | cut -d= -f2- | tr -d '\r\n')

# Por si el valor se guardo entrecomillado, se le quitan las comillas.
SUPABASE_DB_URL=${SUPABASE_DB_URL#[\'\"]}
SUPABASE_DB_URL=${SUPABASE_DB_URL%[\'\"]}

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  marca "ERROR: SUPABASE_DB_URL vacia en $CONF"
  exit 1
fi

mkdir -p "$DESTINO"
ARCHIVO="$DESTINO/supabase-$(date +%F-%H%M).sql.gz"
PARCIAL="$ARCHIVO.parcial"

marca "Iniciando volcado..."

# Se dumpean los esquemas que son datos de negocio y usuarios. Los esquemas
# internos de Supabase (extensions, realtime, vault...) los gestiona ellos y el
# usuario del pooler no siempre tiene permisos, asi que pedirlos solo genera
# errores ruidosos sin aportar nada recuperable.
if docker run --rm "$IMAGEN" pg_dump \
      --no-owner --no-privileges \
      --schema=public --schema=auth --schema=storage \
      "$SUPABASE_DB_URL" 2>/tmp/pgdump.err | gzip -9 > "$PARCIAL"; then

  # gzip devuelve 0 aunque pg_dump falle a mitad (van en tuberia), asi que se
  # comprueba que el resultado tenga tamano creible antes de darlo por bueno.
  TAM=$(stat -c%s "$PARCIAL")
  if [ "$TAM" -lt 1024 ]; then
    marca "ERROR: el volcado pesa $TAM bytes, demasiado poco. Se descarta."
    head -5 /tmp/pgdump.err | sed 's/^/    /'
    rm -f "$PARCIAL"
    exit 1
  fi
  mv "$PARCIAL" "$ARCHIVO"
  marca "OK: $ARCHIVO ($(numfmt --to=iec "$TAM"))"
else
  marca "ERROR: pg_dump fallo."
  head -5 /tmp/pgdump.err | sed 's/^/    /'
  rm -f "$PARCIAL"
  exit 1
fi

BORRADOS=$(find "$DESTINO" -name 'supabase-*.sql.gz' -mtime +${RETENCION_DIAS} -print -delete | wc -l)
[ "$BORRADOS" -gt 0 ] && marca "Rotacion: borrados $BORRADOS volcados de mas de $RETENCION_DIAS dias."

marca "Copias disponibles: $(find "$DESTINO" -name 'supabase-*.sql.gz' | wc -l)"
