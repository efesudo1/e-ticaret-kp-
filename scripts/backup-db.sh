#!/usr/bin/env bash
# Production MySQL backup scripti.
# Önerilen: cron'a ekle:
#   0 3 * * * /home/deploy/kpi-dashboard/scripts/backup-db.sh
# Bu script:
#   - Günlük yedek alır, gzip'ler
#   - 14 günden eski yedekleri otomatik siler
#   - /home/<user>/backups/ altında saklar

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "❌ .env.production bulunamadı."
  exit 1
fi

set -a
source .env.production
set +a

BACKUP_DIR="${HOME}/backups/kpi-dashboard"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%F_%H%M)
FILE="${BACKUP_DIR}/kpi_${DATE}.sql.gz"

echo "▶ Yedekleniyor: $FILE"
docker exec kpi_mysql mysqldump \
  -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --routines --triggers \
  "${DB_NAME}" | gzip > "$FILE"

echo "  Boyut: $(du -h "$FILE" | cut -f1)"

echo "▶ 14 günden eski yedekleri sil..."
find "$BACKUP_DIR" -name "kpi_*.sql.gz" -mtime +14 -delete

echo "✅ Backup tamamlandı."
ls -lh "$BACKUP_DIR" | tail -5
