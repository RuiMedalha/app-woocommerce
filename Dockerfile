# Hotelequip Product Optimizer - Docker-ready (multi-stage)
# Stage 1: build client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY client/ ./
RUN npm run build

# Stage 2: server + client dist
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev || npm install --omit=dev
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./server/client-dist

ENV NODE_ENV=production
ENV PORT=4000
ENV CLIENT_DIST=/app/server/client-dist

# SQLite e uploads em volume
RUN mkdir -p /app/data /app/server/uploads

EXPOSE 4000
CMD ["node", "server/src/index.js"]
