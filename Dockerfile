# PuzzleX Media website: static pages served by a small Node server (contact form → /data + email)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

WORKDIR /app

# dependencies first, so code changes don't reinstall them
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# messages are kept in /data: mount a volume there so they survive updates
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

CMD ["node", "server.js"]
