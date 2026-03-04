# Multi-stage: build frontend e runtime backend (app única, leve)
# =============================================================

# Stage 1: Build do frontend (Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

ARG VITE_API_URL=https://app.hotelequip.pt/api
ENV VITE_API_URL=${VITE_API_URL}

COPY client/package.json client/package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Stage 2: Backend + servir frontend estático
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/database/hotelequip.db
ENV UPLOADS_DIR=/data/uploads
ENV CLIENT_DIST=/app/client-dist

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --omit=dev --legacy-peer-deps
COPY server/src ./src
COPY --from=frontend-builder /app/client/dist ./client-dist

RUN mkdir -p /data/database /data/uploads \
    && apk add --no-cache curl

EXPOSE 4000
CMD ["node", "src/index.js"]
