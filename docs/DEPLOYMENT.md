# AWS Deploy

Tek EC2 üzerinde `docker compose` ile. Stack: nginx (TLS) → frontend + backend,
yanında Postgres, Redis ve coturn.

## 1. EC2

| Ayar | Değer |
|---|---|
| Tip | `t3.small` (min). Ses trafiği TURN'e düşerse `t3.medium` |
| İşletim sistemi | Ubuntu 24.04 LTS |
| Disk | 30 GB gp3 |
| IP | Elastic IP ata — yeniden başlatmada IP değişmesin |

### Security Group

| Port | Protokol | Kaynak | Neden |
|---|---|---|---|
| 22 | TCP | **yalnızca kendi IP'n** | SSH |
| 80 | TCP | 0.0.0.0/0 | Let's Encrypt doğrulaması + HTTPS yönlendirmesi |
| 443 | TCP | 0.0.0.0/0 | Uygulama |
| 3478 | TCP + UDP | 0.0.0.0/0 | TURN/STUN |
| 49160-49200 | UDP | 0.0.0.0/0 | TURN relay aralığı |

> Relay aralığı `infra/coturn/turnserver.conf` içindeki `min-port`/`max-port`
> ile **birebir aynı** olmalı. Uyuşmazsa bağlantı kurulur ama ses akmaz.

## 2. Sunucu hazırlığı

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu   # yeniden giriş yapın

sudo mkdir -p /opt/gameteams && sudo chown ubuntu:ubuntu /opt/gameteams
git clone <repo-url> /opt/gameteams
cd /opt/gameteams
```

## 3. Ortam değişkenleri

```bash
cp .env.example .env
openssl rand -base64 48   # JWT_SECRET
openssl rand -hex 32      # TURN_SECRET
nano .env
```

Doldurulması zorunlu: `DOMAIN`, `APP_URL`, `CORS_ALLOWED_ORIGINS`,
`DB_PASSWORD`, `JWT_SECRET`, `TURN_SECRET`, `TURN_URLS`, SES bilgileri.

**`ADMIN_PASSWORD` boş bırakın** — dolu olursa açılışta admin hesabı seed edilir.

`COOKIE_SECURE=true` olmalı; aksi halde refresh cookie'si düz HTTP üzerinden de
gönderilir.

## 4. DNS ve TLS

Route53'te `DOMAIN` için Elastic IP'ye A kaydı açın, yayılmasını bekleyin:

```bash
dig +short "$DOMAIN"    # Elastic IP'yi göstermeli
```

### İlk sertifika

Tavuk-yumurta durumu: nginx sertifika olmadan başlamaz, certbot da doğrulama
için 80 portuna ihtiyaç duyar. Bu yüzden ilk sertifika nginx kapalıyken
`--standalone` ile alınır:

```bash
cd /opt/gameteams
set -a; source .env; set +a

docker run --rm -p 80:80   -v /opt/gameteams/infra/certbot/conf:/etc/letsencrypt   -v /opt/gameteams/infra/certbot/www:/var/www/certbot   certbot/certbot certonly --standalone -d "$DOMAIN"   --agree-tos -m "$ADMIN_CONTACT_EMAIL" --no-eff-email
```

nginx yapılandırmasını **elle düzenlemeyin** — `infra/nginx/default.conf.template`
bir şablondur, nginx konteyneri açılışta `${DOMAIN}` yerine `.env` içindeki
değeri yazar.

### Yenileme

nginx ayağa kalktıktan sonra yenilemeler **webroot** ile yapılır; `--standalone`
80 portunu ister ve nginx çalışırken bunu alamaz. İlk yenilemeyi elle çalıştırıp
certbot'un kayıtlı yöntemini webroot'a çevirin:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

docker run --rm   -v /opt/gameteams/infra/certbot/conf:/etc/letsencrypt   -v /opt/gameteams/infra/certbot/www:/var/www/certbot   certbot/certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN"   --agree-tos -m "$ADMIN_CONTACT_EMAIL" --no-eff-email --force-renewal
```

Sonra haftalık cron:

```bash
( crontab -l 2>/dev/null; echo '0 3 * * 0 cd /opt/gameteams && docker run --rm -v /opt/gameteams/infra/certbot/conf:/etc/letsencrypt -v /opt/gameteams/infra/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T nginx nginx -s reload' ) | crontab -
```

`nginx -s reload` yeniden başlatmaz; açık WebSocket bağlantıları kopmaz.

## 5. coturn

Yapılandırma dosyasında doldurulacak bir şey yok — sır, realm ve dış IP
`docker-compose.prod.yml` içinden komut satırıyla geçilir. `.env` içine:

```
TURN_SECRET=<openssl rand -hex 32 çıktısı>
TURN_EXTERNAL_IP=<Elastic IP>
TURN_URLS=turn:<DOMAIN>:3478
```

`TURN_SECRET` hem coturn'e hem backend'e aynı `.env`'den gider; iki yerde
farklı olursa tarayıcı TURN'e kimlik doğrulayamaz ve ses kurulmaz.

## 6. AWS SES

1. SES konsolunda domain doğrulayın, DKIM kayıtlarını Route53'e ekleyin.
2. SMTP credential üretin → `MAIL_USERNAME` / `MAIL_PASSWORD`.
3. `MAIL_HOST=email-smtp.<region>.amazonaws.com`, `MAIL_PORT=587`.

> **Sandbox'tan çıkış başvurusunu deploy'dan önce yapın.** Onay 24-48 saat
> sürebilir ve sandbox'ta yalnızca doğrulanmış adreslere mail gider — yani
> kayıt onayı gerçek kullanıcılar için çalışmaz.

## 7. Deploy

```bash
./scripts/deploy.sh
```

Script `.env` içindeki sırların placeholder olmadığını doğrular, imajları
derler, veritabanı yedeği alır ve sağlık kontrolü yapar. Flyway migration'ları
backend açılışında otomatik uygulanır.

Sunucu yeniden başlayınca stack de kalksın:

```bash
sudo cp infra/systemd/gameteams.service /etc/systemd/system/
sudo systemctl enable gameteams
```

## 8. Yedekleme

```bash
echo "0 3 * * * /opt/gameteams/scripts/backup-db.sh >> /var/log/gameteams-backup.log 2>&1" | crontab -
```

`.env` içinde `BACKUP_S3_BUCKET` doluysa yedek S3'e de kopyalanır. Diskteki
yedek sunucuyla birlikte kaybolacağı için bu önerilir.

## 9. Deploy sonrası doğrulama

- [ ] `https://<DOMAIN>` açılıyor, sertifika geçerli
- [ ] `curl https://<DOMAIN>/actuator/health/readiness` → `"status":"UP"`
      (deploy ve konteyner sağlık kontrolü bunu kullanır; mail dahil değildir)
- [ ] `curl https://<DOMAIN>/actuator/health` → mail bileşeni `UP`
      (DOWN ise SES ayarları hatalı; uygulama çalışır ama mail gitmez)
- [ ] Kayıt ol → **gerçek** doğrulama maili geliyor (SES sandbox dışında)
- [ ] Giriş sonrası sayfa yenilendiğinde oturum korunuyor (refresh cookie)
- [ ] Tarayıcı konsolunda `wss://` bağlantısı kuruluyor, mesaj anlık gidiyor
- [ ] **Farklı ağlardaki iki cihaz** (mobil veri ↔ ev wifi) ses kanalında
      birbirini duyuyor — TURN'ün gerçekten çalıştığını yalnızca bu doğrular
- [ ] `chrome://webrtc-internals` → seçilen `candidate-pair` tipi `relay`
      olabiliyor (TURN devrede)
- [ ] Ekran paylaşımı karşı tarafta görünüyor

## Sorun giderme

**WebSocket 30-60 saniyede kopuyor** — nginx `proxy_read_timeout` düşük.
`infra/nginx/default.conf` içinde `/ws` bloğunda 3600s olmalı.

**Ses kurulmuyor, ICE `failed`** — TURN erişilemiyor. Security group'ta
3478 ve relay aralığı açık mı, `external-ip` doğru mu, `TURN_SECRET` iki
yerde aynı mı kontrol edin.

**Mailler gitmiyor** — SES sandbox'ta olabilir; `docker compose logs backend`
içinde SMTP hatasına bakın. `/actuator/health` içindeki `mail` bileşeni durumu
da ipucu verir. Mail arızası deploy'u engellemez: sağlık kontrolü `readiness`
grubunu kullanır ve mail o gruba dahil değildir.

**Rate limit herkesi kilitliyor** — nginx `X-Forwarded-For` göndermiyorsa tüm
istekler tek IP'den geliyor görünür. Proxy başlıklarını kontrol edin.
