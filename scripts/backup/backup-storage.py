#!/usr/bin/env python3
"""
Copia de seguridad de los archivos de Supabase Storage.

Por que hace falta: `pg_dump` respalda la tabla `storage.objects`, que son solo
los metadatos (nombre, ruta, tamano). Los archivos en si viven fuera de Postgres
y no salen en el volcado. Sin esta copia, restaurar dejaria las piezas de
contenido apuntando a imagenes que ya no existen.

Descarga incremental: si el archivo local ya existe con el mismo tamano, se
salta. Asi la ejecucion diaria solo baja lo nuevo.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

CONF = Path.home() / "agencia-kivuk" / "n8n" / ".env"
DESTINO = Path.home() / "backups" / "storage"


def leer_env(clave):
    for linea in CONF.read_text(encoding="utf-8").splitlines():
        if linea.startswith(clave + "="):
            return linea.split("=", 1)[1].strip()
    return None


SUPABASE_URL = leer_env("SUPABASE_URL")
KEY = leer_env("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not KEY:
    print("ERROR: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env")
    sys.exit(1)

CABECERAS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def peticion(url, datos=None, metodo="GET"):
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    cab = dict(CABECERAS)
    if cuerpo:
        cab["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=cuerpo, headers=cab, method=metodo)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def listar_buckets():
    return [b["name"] for b in peticion(f"{SUPABASE_URL}/storage/v1/bucket")]


def listar_objetos(bucket, prefijo=""):
    """La API lista un nivel cada vez: las carpetas vuelven con id=None."""
    encontrados = []
    desplazamiento = 0
    while True:
        lote = peticion(
            f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
            {"prefix": prefijo, "limit": 100, "offset": desplazamiento,
             "sortBy": {"column": "name", "order": "asc"}},
            "POST",
        )
        if not lote:
            break
        for item in lote:
            nombre = item["name"]
            ruta = f"{prefijo}{nombre}" if prefijo else nombre
            if item.get("id") is None:
                encontrados.extend(listar_objetos(bucket, ruta + "/"))
            else:
                tam = (item.get("metadata") or {}).get("size", 0)
                encontrados.append((ruta, tam))
        if len(lote) < 100:
            break
        desplazamiento += 100
    return encontrados


def descargar(bucket, ruta, destino):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{urllib.parse.quote(ruta)}"
    req = urllib.request.Request(url, headers=CABECERAS)
    with urllib.request.urlopen(req, timeout=180) as r:
        destino.parent.mkdir(parents=True, exist_ok=True)
        parcial = destino.with_suffix(destino.suffix + ".parcial")
        parcial.write_bytes(r.read())
        parcial.rename(destino)


def main():
    total_nuevos = total_saltados = total_fallos = total_bytes = 0

    for bucket in listar_buckets():
        objetos = listar_objetos(bucket)
        print(f"Bucket '{bucket}': {len(objetos)} archivos en Supabase")

        for ruta, tam in objetos:
            local = DESTINO / bucket / ruta
            if local.exists() and tam and local.stat().st_size == tam:
                total_saltados += 1
                continue
            try:
                descargar(bucket, ruta, local)
                total_nuevos += 1
                total_bytes += local.stat().st_size
            except Exception as e:
                print(f"  FALLO {ruta}: {e}")
                total_fallos += 1

    print(f"Descargados: {total_nuevos} | Ya estaban: {total_saltados} | Fallos: {total_fallos}")
    print(f"Bytes nuevos: {total_bytes:,}")
    if DESTINO.exists():
        n = sum(1 for p in DESTINO.rglob("*") if p.is_file())
        tam = sum(p.stat().st_size for p in DESTINO.rglob("*") if p.is_file())
        print(f"Copia local total: {n} archivos, {tam / 1024 / 1024:.1f} MB")
    sys.exit(1 if total_fallos else 0)


if __name__ == "__main__":
    import urllib.parse
    main()
