#!/usr/bin/env bash
# Postgres yedegi. Cron ile gunluk calistirilabilir:
#   0 3 * * * /opt/gameteams/scripts/backup-db.sh >> /var/log/gameteams-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-/var/backups/gameteams}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/gameteams-${STAMP}.sql.gz"

# shellcheck disable=SC1091
set -a; source .env; set +a

mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres \
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "$FILE"

echo "Yedek alindi: ${FILE} ($(du -h "$FILE" | cut -f1))"

# S3 tanimliysa kopyala. Diskteki yedek sunucuyla birlikte kaybolur.
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  aws s3 cp "$FILE" "s3://${BACKUP_S3_BUCKET}/postgres/" --only-show-errors
  echo "S3'e yuklendi: s3://${BACKUP_S3_BUCKET}/postgres/"
fi

# Eski yedekleri temizle; disk dolmasin.
find "$BACKUP_DIR" -name 'gameteams-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
