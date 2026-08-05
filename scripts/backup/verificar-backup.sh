#!/usr/bin/env bash
# Un backup que nadie ha abierto no es un backup. Esto comprueba que el volcado
# contiene las tablas del negocio y cuantas filas de datos lleva cada una.
set -uo pipefail

ULTIMO=$(ls -t ~/backups/db/supabase-*.sql.gz 2>/dev/null | head -1)
if [ -z "$ULTIMO" ]; then echo "No hay ningun volcado."; exit 1; fi

echo "Archivo: $ULTIMO"
echo "Tamano : $(du -h "$ULTIMO" | cut -f1)"
echo ""

echo "=== ¿EL GZIP ESTA INTEGRO? ==="
if gunzip -t "$ULTIMO" 2>/dev/null; then echo "  si, se descomprime sin errores"; else echo "  NO - archivo corrupto"; exit 1; fi
echo ""

echo "=== TABLAS INCLUIDAS Y FILAS DE DATOS ==="
# Cada tabla se vuelca como `COPY tabla (...) FROM stdin;` seguido de sus filas
# hasta una linea con solo `\.`. Contamos las lineas de cada bloque.
gunzip -c "$ULTIMO" | awk '
  /^COPY / {
    tabla = $2
    contando = 1
    n = 0
    next
  }
  contando && /^\\\.$/ {
    printf "  %-42s %6d filas\n", tabla, n
    contando = 0
    next
  }
  contando { n++ }
'
echo ""

echo "=== ESQUEMAS PRESENTES ==="
gunzip -c "$ULTIMO" | grep -oE '^CREATE TABLE [a-z_]+\.' | sort -u | sed 's/CREATE TABLE /  /'
