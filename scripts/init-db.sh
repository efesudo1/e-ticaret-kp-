#!/usr/bin/env bash
# Production'da MySQL'i ilk kez veriyle doldurmak için.
# Kullanım:
#   1) Yerel makinede: scp database/init/00_backup.sql deploy@SUNUCU:/tmp/
#   2) Sunucuda: ./scripts/init-db.sh /tmp/00_backup.sql

set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Kullanım: $0 <backup_dosyasi.sql>"
  echo "  Örnek: $0 /tmp/00_backup.sql"
  exit 1
fi

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "❌ .env.production bulunamadı."
  exit 1
fi

# .env.production'dan değişkenleri yükle
set -a
source .env.production
set +a

echo "▶ MySQL container hazır mı?"
until docker exec kpi_mysql mysqladmin ping -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" --silent 2>/dev/null; do
  echo "  Bekleniyor..."
  sleep 2
done

echo "▶ Backup dosyasını container'a kopyala..."
docker cp "$BACKUP_FILE" kpi_mysql:/tmp/restore.sql

echo "▶ Mevcut users tablosunu yedekle (sıfırlanmasın)..."
docker exec kpi_mysql sh -c \
  "mysqldump -uroot -p${MYSQL_ROOT_PASSWORD} ${DB_NAME} users > /tmp/users_backup.sql 2>/dev/null || true"

echo "▶ Backup'ı yükle (DROP/CREATE/INSERT)..."
docker exec kpi_mysql sh -c \
  "mysql -uroot -p${MYSQL_ROOT_PASSWORD} ${DB_NAME} < /tmp/restore.sql"

echo "▶ Önceki users tablosunu geri yükle (varsa)..."
docker exec kpi_mysql sh -c "
  if [ -s /tmp/users_backup.sql ]; then
    mysql -uroot -p${MYSQL_ROOT_PASSWORD} ${DB_NAME} -e 'TRUNCATE TABLE users;'
    mysql -uroot -p${MYSQL_ROOT_PASSWORD} ${DB_NAME} < /tmp/users_backup.sql
  fi
"

echo "▶ Redis cache'i temizle..."
docker exec kpi_redis redis-cli FLUSHALL >/dev/null

echo "▶ Doğrulama:"
docker exec kpi_mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" -e \
  "SELECT 'orders' AS tablo, COUNT(*) AS kayit FROM orders
   UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
   UNION ALL SELECT 'meta_ads', COUNT(*) FROM meta_ads
   UNION ALL SELECT 'google_ads', COUNT(*) FROM google_ads
   UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
   UNION ALL SELECT 'products', COUNT(*) FROM products
   UNION ALL SELECT 'users', COUNT(*) FROM users;" 2>/dev/null

echo ""
echo "✅ Veritabanı yüklendi."
