#!/usr/bin/env bash
# GameTeams deploy. EC2 uzerinde repo kokunden calistirilir.
#
#   ./scripts/deploy.sh           imajlari sunucuda derler (elle deploy)
#   ./scripts/deploy.sh --pull    GHCR'daki hazir imajlari ceker (CI/CD)
#
# --pull tercih edilir: t3.small'da Maven ve npm build'i calisan stack ile
# birlikte bellegi zorlar. Ilk kurulum icin docs/DEPLOYMENT.md'ye bakin.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
MODE="build"
[[ "${1:-}" == "--pull" ]] && MODE="pull"

if [[ ! -f .env ]]; then
  echo "HATA: .env yok. .env.example'i kopyalayip doldurun." >&2
  exit 1
fi

# Sirlarin gercekten doldurulduguna emin ol; placeholder ile deploy edilirse
# uretim ortami tahmin edilebilir bir JWT anahtariyla calisirdi.
for required in JWT_SECRET DB_PASSWORD APP_URL DOMAIN TURN_SECRET TURN_EXTERNAL_IP; do
  value="$(grep -E "^${required}=" .env | cut -d= -f2- || true)"
  if [[ -z "$value" || "$value" == change-me* ]]; then
    echo "HATA: .env icindeki ${required} doldurulmamis." >&2
    exit 1
  fi
done

# CI belirli bir surumu deploy edebilsin; verilmezse .env'deki etiket gecerli.
# Mevcut etiket soyulup yenisi yazilir; aksi halde "...:latest:sha" olusurdu.
# Kabuktan export edilen deger .env'dekinin onune gecer (compose onceligi).
if [[ -n "${IMAGE_TAG:-}" ]]; then
  strip_tag() { sed -E 's/:[^:/]+$//'; }
  backend_base="$(grep -E '^BACKEND_IMAGE=' .env | cut -d= -f2- | strip_tag)"
  frontend_base="$(grep -E '^FRONTEND_IMAGE=' .env | cut -d= -f2- | strip_tag)"

  if [[ -z "$backend_base" || -z "$frontend_base" ]]; then
    echo "HATA: .env icinde BACKEND_IMAGE/FRONTEND_IMAGE tanimli degil." >&2
    exit 1
  fi

  export BACKEND_IMAGE="${backend_base}:${IMAGE_TAG}"
  export FRONTEND_IMAGE="${frontend_base}:${IMAGE_TAG}"
  echo "==> Surum: ${IMAGE_TAG}"
fi

echo "==> Yapilandirma dosyalari guncelleniyor"
# Compose, nginx sablonu ve coturn ayarlari repodan gelir; imajlar registry'den.
# reset --hard: sunucu her zaman main ile birebir ayni olmali. Takip edilmeyen
# dosyalara (.env, infra/certbot/) dokunmaz.
git fetch --quiet origin
git reset --hard --quiet origin/main

echo "==> Veritabani yedegi aliniyor (geri donus icin)"
./scripts/backup-db.sh || echo "UYARI: yedek alinamadi, devam ediliyor"

if [[ "$MODE" == "pull" ]]; then
  echo "==> Imajlar cekiliyor"
  $COMPOSE pull backend frontend
  echo "==> Servisler baslatiliyor"
  $COMPOSE up -d --remove-orphans --no-build
else
  echo "==> Imajlar derleniyor"
  $COMPOSE build
  echo "==> Servisler baslatiliyor"
  $COMPOSE up -d --remove-orphans
fi

echo "==> Saglik kontrolu"
# nginx 80 portunda ACME yolu disindaki her seyi 443'e yonlendirir; duz HTTP
# ile sorgulamak 301 doner ve saglikli deploy bile basarisiz gorunurdu.
# --resolve ile alan adi 127.0.0.1'e cozulur, boylece TLS dogrulamasi gercek
# sertifikaya karsi yapilir ve -k ile dogrulamayi kapatmaya gerek kalmaz.
health_domain="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"
health_url="https://${health_domain}/actuator/health/readiness"

# Flyway migration'lari backend acilisinda otomatik uygulanir.
for attempt in $(seq 1 60); do
  if curl -fsS --resolve "${health_domain}:443:127.0.0.1" "$health_url" 2>/dev/null | grep -q '"status":"UP"'; then
    echo "Deploy tamam."
    $COMPOSE ps
    # Eski imajlar diski doldurmasin.
    docker image prune -f --filter "until=168h" > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 5
done

echo "HATA: Backend 5 dakika icinde saglikli hale gelmedi." >&2
$COMPOSE logs --tail=50 backend >&2
exit 1
