# Panel de administración (Next.js) para el VPS.
#
# Tres etapas para que la imagen final no lleve ni el código fuente ni las
# dependencias de compilación: solo el servidor `standalone` que produce Next.
#
# Base Debian (`slim`) y no Alpine, aunque Alpine sea más pequeña. Motivo: Next
# compila con Turbopack, que necesita su binario nativo (`@next/swc-*`). Alpine
# usa musl y necesita la variante `-musl`, que es una dependencia OPCIONAL de
# npm — y las opcionales que fallan al instalarse se ignoran en silencio. El
# resultado era una imagen que parecía correcta y reventaba al compilar con
# «Turbopack is not supported on this platform», sin pista de por qué. Con
# glibc funciona la variante `-gnu`, que es la que npm instala de forma fiable.
# La imagen pesa unas decenas de megas más; el disco del VPS va sobrado.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las NEXT_PUBLIC_* se incrustan en el JavaScript que se envía al navegador, así
# que tienen que existir en tiempo de compilación, no de arranque. Por eso
# entran como build args y no como variables del contenedor.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# No correr como root dentro del contenedor. En Debian los comandos son
# `groupadd`/`useradd`, no los `addgroup`/`adduser` de Alpine.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
