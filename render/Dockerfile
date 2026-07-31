FROM node:22-alpine

# ffmpeg para los reels.
#
# Las fuentes no son opcionales: el texto se compone rasterizando un SVG, y en
# una imagen sin fuentes instaladas el texto sale en blanco sin dar ningún
# error. Noto cubre tildes y eñes, que aquí no son un detalle.
RUN apk add --no-cache ffmpeg font-noto font-noto-extra fontconfig \
    && fc-cache -f

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/server.js"]
