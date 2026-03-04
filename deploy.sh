#!/usr/bin/env bash
# Deploy Hotelequip Optimizer no VPS (Docker)
# Uso: ./deploy.sh   ou   bash deploy.sh
# Requer: Docker e Docker Compose instalados

set -e
cd "$(dirname "$0")"

echo "[Deploy] Build e arranque em modo daemon..."
docker compose build --no-cache
docker compose up -d

echo "[Deploy] A aguardar healthcheck..."
sleep 5
docker compose ps

echo "[Deploy] Concluído. App a correr em portas 5173 (UI) e 4000 (API)."
echo "Configure o Nginx Proxy Manager: app.hotelequip.pt -> 172.17.0.1:5173 (ou IP do host:5173)."
