# GameTeams

Oyuncular için Discord benzeri sohbet uygulaması: odalar, metin ve ses kanalları,
arkadaş sistemi ve **Quick Match** — oyun, takım boyutu, rank ve bölgeye göre
takım arkadaşı eşleştiren kuyruk. Eşleşen oyuncular otomatik olarak geçici bir
odaya ve ses kanalına düşer.

## Teknolojiler

| Katman | Seçim |
|---|---|
| Backend | Java 21, Spring Boot 3.5.3, Maven Wrapper |
| Veritabanı | PostgreSQL 16 + Flyway |
| Önbellek / presence | Redis 7 |
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4, shadcn |
| Ses | WebRTC mesh + STOMP signaling (coturn TURN ile) |
| Altyapı | Docker Compose; tek EC2'ye deploy |

## Gereksinimler

- JDK 21+ (`JAVA_HOME` ayarlı)
- Node.js 20+
- Docker Desktop (çalışır durumda)

## Hızlı Başlangıç

```bash
# 1) Ortam değişkenleri
cp .env.example .env      # değerleri doldur (özellikle JWT_SECRET ve ADMIN_PASSWORD)

# 2) Altyapı (Postgres, Redis, Mailpit)
docker compose up -d

# 3) Backend
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# 4) Frontend (ayrı terminal)
cd frontend && npm install && npm run dev
```

### Portlar

| Servis | Adres |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Health | http://localhost:8080/actuator/health |
| Mailpit (gelen kutusu) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Dev profilinde giden hiçbir e-posta gerçekten gönderilmez; hepsi Mailpit'te birikir.

## Sorun Giderme

### Maven `PKIX path building failed` hatası veriyor

Antivirüs veya kurumsal proxy HTTPS trafiğini kendi sertifikasıyla imzalıyorsa
(ör. Norton Web/Mail Shield) Windows bu köke güvenir ama JDK'nın kendi
`cacerts` deposu tanımaz ve Maven Central'a bağlanamaz.

Çözüm — Java'yı Windows sertifika deposunu kullanmaya yönlendir:

```bash
# Tek seferlik:
MAVEN_OPTS="-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT" ./mvnw spring-boot:run
```

```powershell
# Kalıcı (yeni terminallerde geçerli olur):
[Environment]::SetEnvironmentVariable('MAVEN_OPTS','-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT','User')
```

Bu ayar sertifika doğrulamasını **kapatmaz**; yalnızca işletim sisteminin zaten
güvendiği kök sertifikaları Java'ya tanıtır. Linux/Docker build'lerinde gerekmez,
o yüzden repoya (`.mvn/jvm.config`) yazılmadı.

### Testcontainers testleri "skipped" görünüyor

`BackendApplicationTests` çalışan bir Docker daemon'a ihtiyaç duyar ve
erişilemiyorsa **atlanır** (başarısız olmaz). Atlanma sebebi genelde şu ikisinden
biridir:

1. **Docker Desktop kapalı** — açıp tekrar deneyin.
2. **Docker Engine 29.x uyumsuzluğu** — Docker Desktop'ın API proxy'si,
   Testcontainers 1.21.x içindeki docker-java istemcisine `/info` çağrısında boş
   gövdeyle `HTTP 400` döndürüyor; aynı named pipe üzerinde `docker` CLI sorunsuz
   çalışır. Testcontainers'ın Docker 29 destekleyen sürümü çıkınca kendiliğinden
   düzelecek.

Bu durumda uygulamayı `docker compose up -d` ile ayağa kalkan gerçek Postgres ve
Redis'e karşı elle doğrulayabilirsiniz — geliştirme akışı etkilenmez.

## Proje Yapısı

```
backend/    Spring Boot API — özellik bazlı paketler (auth, room, channel,
            message, voice, matchmaking, ...), Flyway migration'ları
frontend/   React SPA
              src/components/ui/    shadcn primitive'leri + TwoLevelSidebar
              src/features/         özellik bazlı ekranlar
docker-compose.yml   dev altyapısı
```

## Kimlik API'si

| Uç | Açıklama |
|---|---|
| `POST /api/auth/register` | Kayıt; doğrulama maili gönderir |
| `POST /api/auth/verify-email` | Maildeki token ile hesabı doğrular |
| `POST /api/auth/resend-verification` | Doğrulama mailini yeniden gönderir |
| `POST /api/auth/login` | Access token (gövde) + refresh token (HttpOnly cookie) |
| `POST /api/auth/refresh` | Rotasyonlu token yenileme |
| `POST /api/auth/logout` | Refresh token'ı iptal eder |
| `POST /api/auth/forgot-password` | Sıfırlama maili gönderir |
| `POST /api/auth/reset-password` | Yeni şifre belirler, tüm oturumları kapatır |
| `GET /api/auth/me` | Giriş yapmış kullanıcının profili |

Güvenlik notları:

- Access token 15 dakika, refresh token 30 gün. Refresh **rotasyonlu**: her
  yenilemede eski token iptal edilir. İptal edilmiş bir token tekrar gelirse
  hırsızlık varsayılır ve kullanıcının **tüm** oturumları kapatılır.
- Token'lar veritabanına SHA-256 özeti olarak yazılır, ham hâlleriyle değil.
- `forgot-password` ve `resend-verification`, adres kayıtlı olsun olmasın aynı
  yanıtı döner (e-posta enumeration önlemi).
- Rate limit: login 10/dk, register 5/saat, mail gönderen uçlar 3/saat (IP başına).

## Oda ve Kanal API'si

| Uç | Açıklama |
|---|---|
| `GET /api/rooms` | Üyesi olduğun odalar |
| `POST /api/rooms` | Oda oluştur (bir metin + bir ses kanalı ile açılır) |
| `POST /api/rooms/join` | Davet koduyla katıl |
| `GET /api/rooms/{id}` | Oda detayı + kanallar |
| `PATCH /api/rooms/{id}` | Oda ayarları (sahip) |
| `DELETE /api/rooms/{id}` | Odayı sil (sahip) |
| `POST /api/rooms/{id}/leave` | Odadan ayrıl (sahip ayrılamaz) |
| `GET /api/rooms/{id}/members` | Üye listesi |
| `DELETE /api/rooms/{id}/members/{userId}` | Üye at (sahip) |
| `POST /api/rooms/{id}/invite-code` | Davet kodunu yenile (sahip) |
| `GET/POST /api/rooms/{id}/channels` | Kanal listesi / oluştur |
| `PATCH/DELETE /api/channels/{id}` | Kanal düzenle / sil (sahip) |

Erişim kuralları:

- Üye olmayan bir odaya erişim **404** döner, 403 değil: 403 "bu oda var ama
  giremezsin" bilgisini sızdırırdı.
- Davet kodu yalnızca oda sahibine gönderilir; üye yanıtında `null` gelir.
- Kanal erişimi her zaman odaya üyelik üzerinden doğrulanır; kanal id bilmek
  tek başına yetki vermez.
- Odanın son kanalı silinemez, sahip odadan ayrılamaz (oda sahipsiz kalmasın).
- Ses kanalı `userLimit` üst sınırı **8** — mesh WebRTC bunun üstünde pratik değil.

## Durum

Phase 0-2 tamam:

- [x] Repo yapısı, `.gitignore`, `.env.example`
- [x] Dev altyapısı (Postgres, Redis, Mailpit)
- [x] Spring Boot iskeleti, güvenlik yapılandırması, health check
- [x] Flyway V1 — kullanıcı ve token şeması
- [x] Frontend kabuğu — ray, kanal paneli, sohbet, üye listesi, ses çubuğu
- [x] Phase 1 — kayıt, e-posta doğrulama, giriş, token rotasyonu, şifre sıfırlama, admin seed
- [x] Phase 2 — odalar, kanallar, davet kodu, üyelik ve sahiplik kontrolleri
- [ ] Phase 3 — metin sohbeti (STOMP)
- [ ] Phase 4 — ses kanalları (WebRTC mesh + ekran paylaşımı)
- [ ] Phase 5 — arkadaşlar ve DM
- [ ] Phase 6 — Quick Match
- [ ] Phase 7 — cila ve admin paneli
- [ ] Phase 8 — prod compose, nginx + TLS, AWS deploy
