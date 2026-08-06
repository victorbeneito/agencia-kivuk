#!/usr/bin/env bash
#
# Despliega en el VPS lo que haya cambiado en el repo, y solo eso.
#
#   ssh kivuk@LA_IP
#   ~/agencia-kivuk/scripts/desplegar.sh
#
# Existe porque `git pull` a secas NO despliega nada:
#
#   - El panel y `render` corren desde una imagen de Docker ya construida. El
#     codigo nuevo esta en el disco, pero el contenedor sigue con el viejo hasta
#     que se reconstruye.
#   - Los workflows de n8n viven en SU base de datos, no en los .json. Puedes
#     tener el JSON nuevo en el servidor y n8n ejecutando el de la semana
#     pasada sin que nada avise.
#
# Reconstruir todo cada vez son varios minutos, asi que se mira que ha tocado
# el pull y se actua en consecuencia.
set -uo pipefail

REPO=~/agencia-kivuk
cd "$REPO" || { echo "No existe $REPO"; exit 1; }

DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

titulo() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()     { printf '  \033[32m%s\033[0m\n' "$*"; }
info()   { printf '  %s\n' "$*"; }

ANTES=$(git rev-parse HEAD)

titulo "Trayendo cambios de GitHub"
if ! git pull --ff-only 2>&1 | sed 's/^/  /'; then
  echo "  El pull ha fallado. Si has editado archivos en el servidor, mira 'git status'."
  exit 1
fi
DESPUES=$(git rev-parse HEAD)

if [ "$ANTES" = "$DESPUES" ]; then
  ok "Ya estaba al dia, no hay nada que desplegar."
  exit 0
fi

CAMBIOS=$(git diff --name-only "$ANTES" "$DESPUES")
info "$(echo "$CAMBIOS" | wc -l) archivos cambiados"
echo "$CAMBIOS" | sed 's/^/    /'

cambio() { echo "$CAMBIOS" | grep -q "^$1"; }

cd "$REPO/n8n"

# --- Panel de Next.js -------------------------------------------------------
if cambio "app/"; then
  titulo "El panel ha cambiado: reconstruyendo"
  if $DC up -d --build panel 2>&1 | tail -3 | sed 's/^/  /'; then
    ok "Panel desplegado."
  else
    echo "  FALLO al reconstruir el panel."
  fi
fi

# --- Servicio de render -----------------------------------------------------
if cambio "render/"; then
  titulo "El servicio de render ha cambiado: reconstruyendo"
  $DC up -d --build render 2>&1 | tail -3 | sed 's/^/  /'
  ok "Render desplegado."
fi

# --- Workflows de n8n -------------------------------------------------------
if cambio "n8n/workflows/"; then
  titulo "Workflows modificados"
  for f in $(echo "$CAMBIOS" | grep '^n8n/workflows/.*\.json$'); do
    # La copia de respaldo antigua no se despliega.
    case "$f" in *whatsapp-bot-v1-calendar.json) continue ;; esac
    info "-> $f"
    node "$REPO/scripts/desplegar-workflow.js" "$f" --aplicar 2>&1 | sed 's/^/     /'
  done
  ok "Workflows actualizados en n8n."
fi

# --- Proxy ------------------------------------------------------------------
if cambio "n8n/Caddyfile"; then
  titulo "Caddyfile modificado: recargando el proxy"
  $DC up -d caddy 2>&1 | tail -2 | sed 's/^/  /'
  ok "Caddy recargado."
fi

# --- Compose ----------------------------------------------------------------
if cambio "n8n/docker-compose"; then
  titulo "El compose ha cambiado: aplicando a todos los servicios"
  $DC up -d 2>&1 | tail -5 | sed 's/^/  /'
  ok "Servicios actualizados."
fi

titulo "Estado final"
$DC ps --format 'table {{.Service}}\t{{.Status}}' | sed 's/^/  /'

titulo "Comprobacion"
for url in https://n8n.agenciakivuk.com https://panel.agenciakivuk.com/login; do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url")
  if [ "$codigo" = "200" ]; then ok "$url -> $codigo"; else echo "  AVISO $url -> $codigo"; fi
done
echo ""
