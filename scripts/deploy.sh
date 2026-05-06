#!/usr/bin/env bash
# Production deploy scripti — DigitalOcean Droplet üzerinde çalıştırılır.
# Kullanım: ./scripts/deploy.sh
#
# Bu script:
#   1) En son git pull yapar (eğer git repo ise)
#   2) Docker image'larını yeniden build eder
#   3) Compose'u up -d ile yeniden başlatır
#   4) Eski (dangling) image'ları temizler

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "❌ .env.production bulunamadı. .env.production.example'dan kopyalayıp doldurun."
  exit 1
fi

echo "▶ Git pull..."
if [ -d .git ]; then
  git pull --ff-only || echo "  (git pull atlandı)"
fi

echo "▶ Docker compose build & up..."
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build

echo "▶ Eski image'ları temizle..."
docker image prune -f

echo "▶ Servis durumu:"
docker compose --env-file .env.production -f docker-compose.production.yml ps

echo ""
echo "✅ Deploy tamamlandı."
echo "   Logları izlemek için: docker compose -f docker-compose.production.yml logs -f"
