# ==============================================================================
# Calculator API Dockerfile
# ==============================================================================
# Express backend exposing /calc/* endpoints for GPT Panelin Actions.
# Build context must be the repo root (needs server/ + src/).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

FROM node:20-alpine AS runtime
LABEL maintainer="BMC Uruguay / METALOG SAS"
LABEL description="Panelin Calculator API for GPT Actions"
WORKDIR /app

# Chromium + dependencies for server-side PDF via puppeteer-core
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-emoji \
    udev \
    && rm -rf /var/cache/apk/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY server/ ./server/
COPY src/utils/ ./src/utils/
COPY src/data/ ./src/data/

RUN addgroup -g 1001 -S panelin && \
    adduser -S -u 1001 -G panelin panelin && \
    chown -R panelin:panelin /app

USER panelin

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENV NODE_ENV=production \
    PORT=8080 \
    CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

CMD ["node", "server/index.js"]
