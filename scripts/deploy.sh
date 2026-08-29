#!/usr/bin/env bash
# GameTeams deploy. EC2 uzerinde repo kokunden calistirilir.
#
#   ./scripts/deploy.sh
#
# Ilk kurulum icin docs/DEPLOYMENT.md'ye bakin.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "HATA: .env yok. .env.example'i kopyalayip doldurun." >&2
  exit 1
fi

# Sirlarin gercekten doldurulduguna emin ol; placeholder ile deploy edilirse
# uretim ortami tahmin edilebilir bir JWT anahtariyla calisirdi.
for required in JWT_SECRET DB_PASSWORD APP_URL DOMAIN; do
  value="$(grep -E "^${required}=" .env | cut -d= -f2- || true)"
  if [[ -z "$value" || "$value" == change-me* ]]; then
    echo "HATA: .env icindeki ${required} doldurulmamis." >&2
    exit 1
  fi
done

echo "==> Son degisiklikler cekiliyor"
git pull --ff-only

echo "==> Imajlar derleniyor"
$COMPOSE build

echo "==> Veritabani yedegi aliniyor (geri donus icin)"
./scripts/backup-db.sh || echo "UYARI: yedek alinamadi, devam ediliyor"

echo "==> Servisler baslatiliyor"
# Flyway migration'lari backend acilisinda otomatik uygulanir.
$COMPOSE up -d --remove-orphans

echo "==> Saglik kontrolu"
for attempt in $(seq 1 60); do
  if curl -fsS http://localhost/actuator/health 2>/dev/null | grep -q '"status":"UP"'; then
    echo "Deploy tamam."
    $COMPOSE ps
    exit 0
  fi
  sleep 5
done

echo "HATA: Backend 5 dakika icinde saglikli hale gelmedi." >&2
$COMPOSE logs --tail=50 backend >&2
exit 1
