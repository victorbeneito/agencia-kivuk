# Fase 1.5 — Desplegar n8n (y el render) a un VPS

Documento de trabajo para Claude Code. Objetivo: que las automatizaciones dejen de depender del portátil y de ngrok, y pasen a correr 24/7 en un servidor propio con HTTPS y dominio, listo para clientes reales.

Leer antes: `CLAUDE.md`, `docs/architecture.md` y `n8n/workflows/README.md`.

## Por qué ahora

Mientras n8n corra en local con ngrok, el bot de un cliente deja de responder si se apaga el equipo, se cierra la terminal del túnel o Windows se reinicia por una actualización. Para un cliente de pruebas es aceptable; para un cliente que paga, no. Esta fase elimina esa dependencia.

## Qué se despliega

No es solo n8n. El stack actual son cuatro piezas:

| Servicio | Qué hace | Puerto |
| --- | --- | --- |
| `n8n` | Motor de automatizaciones (WhatsApp, agenda, voz, contenido) | 5678, interno |
| `postgres` | Base de datos propia de n8n (ejecuciones, workflows) | interno |
| `render` | Renderiza las piezas de redes sociales (necesita ffmpeg, por eso va aparte) | 3001, interno |
| `caddy` | Proxy inverso con HTTPS automático (nuevo, solo en producción) | 80, 443 |

La base de datos **de negocio** sigue en Supabase (clientes, conversaciones, catálogo). El Postgres del compose es solo para las tripas de n8n.

## Buenas noticias: la migración es limpia

Antes de empezar, tres cosas verificadas en el repo que simplifican mucho el traslado:

1. **Los workflows no guardan credenciales en n8n.** Todo se lee en tiempo de ejecución de variables de entorno (`$env.SUPABASE_URL`, `$env.OPENAI_API_KEY`) o de `client_modules.config` en Supabase. Es decir: exportar/importar los JSON basta, no hay que reintroducir credenciales una a una en el n8n nuevo.
2. **No hay URLs de ngrok escritas dentro de los workflows.** Las únicas URLs internas son `http://localhost:5678` (la Agenda API llamándose a sí misma) y `http://render:3001` (nombre de servicio en la red de Docker). Ambas siguen funcionando igual dentro del servidor, sin tocar nada.
3. **Los JSON ya están versionados** en `n8n/workflows/`, así que se importan desde el repo clonado en el servidor.

Lo único que cambia de verdad es la URL pública y quién apunta a ella.

## Elección de VPS

### El contexto: Hetzner ya no es la respuesta automática (agosto 2026)

Durante años Hetzner era la recomendación obvia. En 2026 ha subido precios **dos veces**:

- **1 de abril**: subida general de hasta un 37 %, aplicada también a clientes existentes.
- **15 de junio**: las líneas de vCPU dedicada **CPX y CCX suben entre un 144 % y un 176 %** (solo para nuevas contrataciones). El CPX22 (2 vCPU / 4 GB) pasó de 7,99 € a **19,49 €/mes**.

El motivo es un choque real de mercado: el precio de la DRAM se ha disparado (~+171 % interanual por la demanda de IA), y las gamas con mucha RAM por núcleo son las que más lo sufren.

La gama económica (**CX / CAX**, en torno a 5,50-6,50 €/mes) solo subió un 33-38 % y sigue siendo muy competitiva — pero a fecha de este documento aparece **agotada** ("currently not available"). Ese stock rota, así que conviene revisar la consola de Hetzner cada pocos días.

### Requisitos reales del stack

n8n en reposo consume poco y el trabajo llega a ráfagas: un mensaje de WhatsApp son milisegundos de CPU, y la mayor parte del tiempo de respuesta se va esperando a la API de OpenAI, no procesando. Lo que de verdad pide músculo es el servicio **`render` con ffmpeg**, sobre todo si se generan vídeos para redes.

Mínimo cómodo: **2 vCPU y 4 GB de RAM**. Recomendable si se va a renderizar en serio: **4 vCPU y 8 GB**.

### Opciones, por orden de recomendación

**1. Contabo (recomendada ahora)** — Alemana, centros de datos en la UE. Desde **~4,50 €/mes por 4 vCPU y 8 GB de RAM**: el doble de recursos que el antiguo CX22 por menos dinero, y justo donde el `render` agradece el margen. Incluye protección DDoS y 30 días de devolución. Contras honestos: discos más lentos y soporte más flojo que Hetzner. Para esta carga de trabajo no es crítico, pero conviene saberlo.

**2. netcup** — Alemana, desde ~3,35 €/mes (2 vCPU / 2 GB; subir de plan para llegar a 4 GB). Menos recursos por euro que Contabo pero rendimiento más consistente y mejor reputación de fiabilidad. Buena elección si se prefiere solidez sobre potencia bruta.

**3. Hetzner CX23 / CAX11** — ~5,50-6,50 €/mes, excelente relación calidad-precio y la mejor consistencia de red dentro de Europa. **Solo si vuelve a haber stock.** Ojo: las CAX son ARM64; el `Dockerfile` de `render` tendría que construir en esa arquitectura (Node y ffmpeg la soportan, pero hay que probarlo).

**4. Hetzner CPX22** — ya no compensa a 19,49 €/mes. Descartada salvo que se necesite específicamente vCPU dedicada.

Otras europeas serias, si se quiere comparar: OVHcloud y Scaleway (Francia), IONOS y STACKIT (Alemania).

**Sea cual sea el proveedor**, exigir tres cosas: centro de datos en la UE (RGPD, hay datos de clientes de por medio), imagen **Ubuntu 24.04 LTS** y **backups automáticos** contratados desde el primer día.

Nota importante: en Hetzner, un *rescale* de un servidor existente cuenta como pedido nuevo y aplica la tarifa actualizada. Si algún día se contrata ahí, conviene dimensionar bien a la primera.

### Qué cambia en esta guía según el proveedor

Muy poco: solo el paso 1 (crear el servidor) y el cortafuegos del panel. Todo lo demás — Docker, Caddy, DNS, `.env`, migración de workflows, checklist — es idéntico en cualquier VPS con Ubuntu.

## Paso a paso

### 1. Crear el servidor

Da igual el proveedor elegido; el proceso es el mismo:

1. Crear cuenta en el proveedor (Contabo, netcup, Hetzner...) y, si lo permite, un proyecto propio: `agencia-kivuk`.
2. Crear servidor: imagen **Ubuntu 24.04 LTS**, ubicación en la **UE** (Alemania o Finlandia), plan según lo elegido arriba.
3. **Añadir clave SSH** en el proceso de alta (no usar contraseña). Si no hay clave todavía, generarla en local:
   ```
   ssh-keygen -t ed25519 -C "agencia-kivuk"
   ```
   y pegar el contenido de `~/.ssh/id_ed25519.pub` en el panel del proveedor.
   Si el proveedor no permite añadir la clave al crear (Contabo a veces envía la contraseña de root por email), entrar con contraseña la primera vez, copiar la clave con `ssh-copy-id` y desactivar el acceso por contraseña en el paso 2.
4. Contratar **backups automáticos**.
5. Nombre: `kivuk-n8n`. Crear.
6. Anotar la IP pública que asigna.

### 2. Asegurar el servidor

Conectar: `ssh root@LA_IP`

```bash
# Actualizar
apt update && apt upgrade -y

# Usuario propio (no trabajar como root)
adduser kivuk
usermod -aG sudo kivuk
rsync --archive --chown=kivuk:kivuk ~/.ssh /home/kivuk

# Cortafuegos: solo SSH y web
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Fail2ban contra fuerza bruta en SSH
apt install -y fail2ban
```

Deshabilitar el acceso SSH por contraseña en `/etc/ssh/sshd_config` (`PasswordAuthentication no`) y `systemctl restart ssh`. A partir de aquí, conectarse como `ssh kivuk@LA_IP`.

**Importante:** los puertos 5678 (n8n) y 3001 (render) **no se abren**. Quedan accesibles solo dentro de la red de Docker; a internet solo asoma Caddy por 80/443. Como refuerzo, configurar también el cortafuegos del panel del proveedor (Hetzner y Contabo lo ofrecen gratis) con esas mismas reglas: 22, 80 y 443.

### 3. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker kivuk
```
Cerrar sesión y volver a entrar para que el grupo tenga efecto. Comprobar con `docker run hello-world`.

### 4. Dominio y DNS

En el registrador del dominio (`agenciakivuk.com`), crear un registro **A**:

```
n8n.agenciakivuk.com   →   A   →   LA_IP_DEL_VPS
```

Comprobar propagación antes de seguir: `dig +short n8n.agenciakivuk.com` debe devolver la IP. Puede tardar de minutos a un par de horas. **No levantar Caddy hasta que el DNS resuelva**, o Let's Encrypt fallará al emitir el certificado y habrá que esperar por límites de reintentos.

### 5. Clonar el repositorio

El servicio `render` se construye desde `../render`, así que hace falta el repo entero, no solo la carpeta `n8n`.

```bash
cd ~
git clone https://github.com/TU_USUARIO/agencia-kivuk.git
cd agencia-kivuk/n8n
```

Si el repo es privado, usar un *deploy key* o un token de acceso personal.

### 6. Crear el `.env` de producción

**A mano en el servidor.** Está en `.gitignore` a propósito y no debe llegar por git ni pegarse en ningún chat.

```bash
cp .env.example .env
nano .env
```

Valores que cambian respecto a local:

```dotenv
N8N_HOST=n8n.agenciakivuk.com
N8N_PROTOCOL=https
WEBHOOK_URL=https://n8n.agenciakivuk.com/

POSTGRES_PASSWORD=<contraseña larga y aleatoria, distinta de la de local>

# Clave con la que n8n cifra lo que guarde. Fijarla explícitamente permite
# mover o recrear el servidor sin perder nada. Generar con: openssl rand -hex 32
N8N_ENCRYPTION_KEY=<64 caracteres hex>
```

El resto (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `META_*`) se copian de los valores reales. Permisos: `chmod 600 .env`.

### 7. Añadir Caddy y ajustar el compose para producción

Crear `n8n/Caddyfile`:

```
n8n.agenciakivuk.com {
    reverse_proxy n8n:5678
}
```

Eso es todo: Caddy pide y renueva el certificado de Let's Encrypt solo.

Crear `n8n/docker-compose.prod.yml` como *override*, para no romper el desarrollo local:

```yaml
services:
  n8n:
    ports: !override []          # no exponer 5678 al exterior
    environment:
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      N8N_PROXY_HOPS: "1"        # n8n está detrás de un proxy
      N8N_RUNNERS_ENABLED: "true"

  render:
    ports: !override []          # no exponer 3001 al exterior

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - n8n

volumes:
  caddy_data:
  caddy_config:
```

Aprovechar para limpiar el `docker-compose.yml` base, que arrastra dos cosas muertas:

- `version: "3.8"` — obsoleto, Docker avisa en cada comando. Borrar la línea.
- `N8N_BASIC_AUTH_ACTIVE` / `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD` — n8n dejó de soportarlas en la v1; no hacen nada. El acceso se controla con la cuenta de propietario de n8n. Borrarlas.

### 8. Levantar

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
docker compose logs -f caddy    # ver que emite el certificado sin errores
```

Abrir `https://n8n.agenciakivuk.com` — debe cargar n8n con candado válido y pedir crear la cuenta de propietario. Crearla con una contraseña fuerte y guardarla en el gestor de contraseñas.

### 9. Importar los workflows

En la interfaz de n8n: menú **⋯ → Import from File**, uno por uno desde `n8n/workflows/`:

- `whatsapp-bot.json`
- `agenda-api.json`
- `voz-vapi.json`
- `catalogo-ingesta.json`
- `contenido-generar.json`
- `publicar-pieza.json`

(`whatsapp-bot-v1-calendar.json` es una copia de seguridad antigua, no hace falta.)

Publicar cada uno que tenga webhook. Comprobar en el nodo Webhook que la Production URL ya sale como `https://n8n.agenciakivuk.com/webhook/...`.

### 10. Reapuntar quién llama a n8n

Aquí es donde se rompe todo si se olvida un sitio. Tres consumidores externos:

**Meta / WhatsApp** — Ir directo a la **página de Webhooks de la app**:

> `https://developers.facebook.com/apps/1861842631636106/webhooks/`
> → *Selecciona un producto*: **WhatsApp Business Account** → **Editar**

- Callback URL: `https://n8n.agenciakivuk.com/webhook/whatsapp-kivuk`
- Verify token: el mismo de siempre (el que compara el nodo `If`).
- Verificar y guardar. Comprobar que el campo `messages` sigue suscrito.
- La suscripción `subscribed_apps` de la WABA **no se pierde**, ya está hecha. No hay que repetirla.

> ⚠️ **La trampa que costó una hora el 5/8/2026.** En *Casos de uso → Personalizar
> → Paso 2. Configuración de producto* también hay un campo de webhook. Cambiarlo
> ahí hace que Meta **verifique** la URL nueva (la petición GET llega y responde
> bien, así que todo parece correcto), pero **sigue entregando los mensajes a la
> URL antigua**. La que manda es la de la página de Webhooks de la app.
>
> Cómo detectarlo: los mensajes se guardan en Supabase pero **no aparece ninguna
> ejecución nueva en el n8n del VPS**. Si el n8n local sigue encendido, es él
> quien los está procesando — y como ambos escriben en la misma Supabase, el
> engaño es perfecto. Comparar el contador de `execution_entity` de las dos
> instancias antes y después de un mensaje lo resuelve en un minuto.
>
> Descartar de paso un `override_callback_uri` a nivel de WABA, que tendría
> prioridad sobre todo lo anterior:
> `GET /{waba-id}/subscribed_apps?access_token=...`

**Ojo con la app:** hay dos apps en Meta. `agencia_kivuk` (id `1861842631636106`)
es la de WhatsApp; `Kivuk Social` es **solo para Instagram** y su desplegable de
productos ni siquiera ofrece *WhatsApp Business Account*.

**Vapi (agente de voz)** — Actualizar la URL del servidor/webhook del assistant para que apunte al dominio nuevo.

**Cron o llamadas externas** que dispararan workflows contra la URL de ngrok, si las hay.

Cuando todo esté verificado y respondiendo, **parar ngrok en local** y apagar el n8n local para no tener dos instancias escuchando y volverse loco depurando.

### 11. Checklist de verificación

No dar la fase por cerrada sin pasar esto entero:

- [ ] `https://n8n.agenciakivuk.com` carga con certificado válido.
- [ ] `http://LA_IP:5678` **no** responde desde fuera (comprobar que el puerto está cerrado).
- [ ] Mensaje real de WhatsApp → llega, responde con IA, y aparece la ejecución en n8n.
- [ ] La conversación y los mensajes se guardan en Supabase.
- [ ] Pedir cita por WhatsApp → consulta disponibilidad y reserva en Google Calendar.
- [ ] Llamada al agente de voz → responde y puede consultar agenda.
- [ ] Generar una pieza de contenido → el servicio `render` produce la imagen.
- [ ] `docker compose ps` muestra los cuatro servicios `Up`.
- [ ] Reiniciar el servidor (`sudo reboot`) y comprobar que **todo vuelve solo** gracias a `restart: unless-stopped`. Esta prueba es la que de verdad valida que ya no dependes de nadie.

## Copias de seguridad

Tres niveles, y conviene tener los tres:

1. **Snapshots de Hetzner** (activados al contratar): recuperación del servidor entero.
2. **Supabase**: los datos de negocio viven ahí. En plan gratuito no hay backups automáticos — es el motivo principal para pasar a Pro cuando haya un cliente pagando.
3. **Workflows**: siguen en git. Cuando se modifique un workflow desde la interfaz del servidor, **exportarlo y commitearlo al repo**. Si no, el servidor y el repo divergen y se pierde el histórico.

Volcado manual del Postgres de n8n, si se quiere:
```bash
docker compose exec postgres pg_dump -U n8n n8n > ~/backup-n8n-$(date +%F).sql
```

## Operación diaria

```bash
cd ~/agencia-kivuk/n8n
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'

dc ps                 # estado
dc logs -f n8n        # logs en vivo
dc restart n8n        # reiniciar un servicio
dc pull && dc up -d   # actualizar n8n a la última versión
```

Para desplegar cambios del repo: `git pull` y `dc up -d --build` (el `--build` es necesario porque `render` se construye desde el código).

Antes de actualizar n8n a una versión mayor, mirar las notas de la versión: los cambios de major han roto cosas antes (el caso de `N8N_BASIC_AUTH_*` en la v1 es justo eso).

## Y el panel de Next.js, ¿qué?

Se queda en Vercel de momento; funciona bien y el plan gratuito da para esto. La opción de moverlo a este mismo VPS con Dokploy sigue en pie (ver `docs/architecture.md`), pero no es urgente ni bloquea nada: hacerlo cuando el coste de Vercel deje de compensar o se quiera todo bajo un mismo techo. Un servidor haciendo una cosa bien es más fácil de depurar que uno haciendo tres.

## Notas para Claude Code

- Los secretos se escriben **solo** en el `.env` del servidor. Nunca en el repo, nunca en un archivo de ejemplo, nunca en un comentario.
- El `docker-compose.yml` base debe seguir sirviendo para desarrollo local sin cambios: todo lo de producción va en el override `docker-compose.prod.yml`.
- No abrir los puertos 5678 ni 3001 al exterior "para probar". Si hace falta acceder puntualmente, usar un túnel SSH: `ssh -L 5678:localhost:5678 kivuk@LA_IP`.
- Al terminar la fase, actualizar `CLAUDE.md` (sección "Cómo correr el proyecto" y "Estado actual") para reflejar que n8n vive en el VPS, y `docs/plan-agencia-ia.md` marcando la Fase 1.5 como completada.
