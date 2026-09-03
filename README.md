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

Testler:

```bash
cd backend  && ./mvnw verify   # 51 test
cd frontend && npm test        # vitest
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

## Mesajlaşma

| Uç | Açıklama |
|---|---|
| `GET /api/channels/{id}/messages?cursor=` | Kanal geçmişi (keyset, 50'lik sayfa) |
| `POST /api/channels/{id}/messages` | Mesaj gönder (REST yedek yolu) |
| `PATCH /api/messages/{id}` | Kendi mesajını düzenle |
| `DELETE /api/messages/{id}` | Kendi mesajını sil (yumuşak silme) |

WebSocket (STOMP, `/ws`):

| Hedef | Yön | İçerik |
|---|---|---|
| `/topic/channel.{id}` | abone | `MESSAGE_CREATED/EDITED/DELETED`, `TYPING` |
| `/app/channel.{id}.send` | gönder | Yeni mesaj |
| `/app/channel.{id}.typing` | gönder | Yazıyor bildirimi |
| `/user/queue/errors` | abone | Yalnızca gönderene giden hatalar |

Notlar:

- Kimlik **CONNECT frame'inde** doğrulanır, handshake URL'inde değil: tarayıcı
  WebSocket API'si özel başlık göndermeye izin vermez ve token'ı URL'e koymak
  sunucu loglarına sızdırırdı.
- **SUBSCRIBE ayrıca yetkilendirilir.** Spring'in bellek içi broker'ı abonelikleri
  doğrulamaz; kanal id bilen herkes `/topic/channel.{id}` dinleyebilirdi.
  Tanınmayan hedefler varsayılan olarak reddedilir.
- Sayfalama **keyset** (`created_at`, `id`) ile yapılır; offset sonsuz scroll
  sırasında yeni mesaj gelince kayar ve mesajları tekrarlar veya atlar.
- Silme **yumuşaktır**: satır durur, içerik gizlenir — yanıt zinciri kırılmasın.

## Ses Kanalları

| Uç | Açıklama |
|---|---|
| `GET /api/webrtc/ice-servers` | STUN + zaman sınırlı TURN kimlik bilgileri |
| `GET /api/voice/channels/{id}/participants` | Kanaldaki kişiler |
| `/app/voice.{id}.join` \| `.leave` \| `.state` | STOMP: katıl / ayrıl / mute-deafen-ekran |
| `/topic/voice.{id}` | `VOICE_JOINED`, `VOICE_LEFT`, `VOICE_STATE` |
| `/app/signal` → `/user/queue/signal` | WebRTC SDP/ICE aktarımı |

> **Ses kanalları HTTPS gerektirir.** Tarayıcılar `getUserMedia` ve
> `getDisplayMedia`'yı yalnızca güvenli bağlamda (`https://` veya `localhost`)
> açar. Düz `http://<IP>` üzerinde `navigator.mediaDevices` tanımsızdır ve izin
> bile sorulmaz — bu yüzden production'da alan adı ve TLS zorunludur.
> Uygulama bu durumu ayırt edip "HTTPS gerekiyor" uyarısı gösterir.

Mimari:

- Ses **P2P mesh** akar; sunucu sesi taşımaz, yalnızca kimin nerede olduğunu
  bilir ve SDP/ICE paketlerini iletir.
- **Teklif kuralı deterministik**: id'si küçük olan taraf teklif başlatır.
  İki taraf aynı anda teklif ederse "glare" oluşur ve el sıkışma başarısız olur.
- **Signaling yetkilendirilir**: gönderen ve alıcı aynı ses kanalında değilse
  paket iletilmez. `fromUserId` sunucu tarafından doldurulur (kimlik taklidi önlemi).
- Ses durumu **Redis'te**; kalıcı olması gerekmiyor ve sunucu yeniden başlarsa
  hayalet katılımcı kalmaz. Bağlantı koptuğunda kullanıcı otomatik düşürülür.
- Aynı anda **tek ses kanalı**: başka kanala katılınca öncekinden çıkarılır ve
  oradaki peer'lara ayrılma duyurulur.
- **TURN zorunlu** (prod): kullanıcıların bir kısmı symmetric NAT arkasındadır
  ve P2P kuramaz. Kimlik bilgileri statik değil, coturn `use-auth-secret` ile
  12 saatlik HMAC imzalı üretilir.

## Arkadaşlar ve DM

| Uç | Açıklama |
|---|---|
| `GET /api/friends` | Arkadaş listesi (çevrimiçi durumuyla) |
| `GET /api/friends/requests/incoming` \| `/outgoing` | Bekleyen istekler |
| `POST /api/friends/requests` | Kullanıcı adıyla istek gönder |
| `POST /api/friends/requests/{id}/accept` | Kabul et |
| `DELETE /api/friends/requests/{id}` | Reddet |
| `DELETE /api/friends/{userId}` | Arkadaşlıktan çıkar |
| `GET/POST /api/conversations` | DM listesi / sohbet aç |
| `GET/POST /api/conversations/{id}/messages` | DM geçmişi / gönder |
| `/user/queue/friends` \| `/user/queue/dm` | Arkadaşlık olayları / gelen DM |

Kurallar:

- **Sadece arkadaşlar DM atabilir.** Aksi halde herkes herkese mesaj gönderebilir
  ve bu bir spam kanalı olur. Arkadaşlık bitse de mevcut sohbet geçmişi korunur.
- **Karşılıklı istek otomatik kabul olur**: A→B beklerken B→A gelirse yeni kayıt
  açmak yerine mevcut istek kabul edilir; aksi halde iki taraf da diğerinin
  onayını beklerdi.
- **Engellenen ilişki kendini ele vermez**: engellenmiş kullanıcıya istek
  gönderildiğinde hata değil normal yanıt döner.
- Kullanıcı çifti **sıralı saklanır** (`user_a_id < user_b_id`), böylece aynı
  ikili için iki ayrı sohbet oluşması veritabanı seviyesinde imkânsızdır.
- Çevrimiçi durumu Redis'te **TTL ile** tutulur; disconnect olayı kaçırılsa bile
  kullanıcı sonsuza dek çevrimiçi görünmez.

## Quick Match

| Uç | Açıklama |
|---|---|
| `GET /api/games` | Oyunlar ve rank kademeleri |
| `GET/PUT /api/me/game-profiles[/{gameId}]` | Oyun profili (rank, oyun içi ad) |
| `GET /api/matchmaking/ticket` | Aktif bilet (kuyrukta değilse 204) |
| `POST /api/matchmaking/queue` | Kuyruğa gir |
| `DELETE /api/matchmaking/queue` | Kuyruktan çık |
| `/user/queue/matchmaking` | `MATCH_FOUND` |

Eşleştirme algoritması:

- **Kesin eşleşen kriterler**: oyun, takım boyutu, bölge, dil. Yalnızca rank
  toleransla esnetilir.
- **Rank toleransı zamanla genişler**: `1 + floor(beklemeSaniyesi / 30)`, tavan 5.
  Böylece nadir rank'taki oyuncu sonsuza kadar beklemez ama ilk saniyelerde
  eşleşme mümkün olduğunca dar tutulur. Tavan olmasaydı uzun bekleyen oyuncu
  her rank ile eşleşirdi.
- **Çapa en eski bilettir**: kuyrukta bekleme süresi adil dağılsın diye.
- **Postgres advisory lock**: ileride birden fazla uygulama örneği çalışsa bile
  aynı bilet iki farklı maça giremez.
- Eşleşince **geçici oda** açılır (bir metin + bir ses kanalı), katılımcılar üye
  yapılır ve herkese `MATCH_FOUND` gider. Boş kalan geçici odalar 30 dakika
  sonra temizlenir.
- Kullanıcı başına **tek aktif bilet** — kısmi benzersiz indeks ile veritabanı
  seviyesinde zorlanır.

## Yönetim

| Uç | Açıklama |
|---|---|
| `GET /api/admin/stats` | Kullanıcı, oda, mesaj sayıları |
| `GET /api/admin/users?q=&page=` | Kullanıcı listesi ve arama |
| `POST /api/admin/users/{id}/disable` \| `/enable` | Hesabı devre dışı bırak / aç |
| `GET /api/admin/rooms` | Oda listesi |
| `DELETE /api/admin/rooms/{id}` | Odayı sil |

Hepsi `ROLE_ADMIN` gerektirir. Arayüz `/admin` adresinde, giriş bağlantısı
yalnızca yöneticilerin ayarlar panelinde görünür.

Kurallar:

- **Devre dışı bırakmak oturumları da kapatır.** Yalnızca işaretlemek yetmez;
  kullanıcı elindeki refresh token ile 30 gün daha oturum açabilirdi. Access
  token'ı süresi dolana kadar (15 dk) geçerli kalır — bu bilinçli bir takas.
- **Yönetici hesapları devre dışı bırakılamaz** ve admin kendini kilitleyemez;
  aksi halde sistemi yönetecek kimse kalmayabilir.
- Hesap silinmez, işaretlenir: mesajlar, oda üyelikleri ve maçlar bozulmaz.
- Sayfa boyutu 100 ile sınırlıdır; aksi halde tek istekle tüm tablo çekilebilirdi.

## Production Deploy

Ayrıntılı adımlar: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) ·
Otomatik deploy: [docs/CI-CD.md](docs/CI-CD.md)

`main` dalına push edildiğinde GitHub Actions testleri koşar, imajları GHCR'a
iter ve sunucu yeni sürümü çeker. Testler kırmızıysa deploy çalışmaz.

```bash
# EC2 üzerinde, /opt/gameteams içinde — yalnızca ilk kurulum
cp .env.example .env && nano .env    # DOMAIN, JWT_SECRET, TURN_SECRET, SMTP...
./scripts/deploy.sh --pull           # CI'nın ittiği imajları çeker
```

Sonraki deploy'lar otomatiktir. Elle müdahale gerekirse:

```bash
IMAGE_TAG=<commit-sha> ./scripts/deploy.sh --pull   # belirli sürüme dön
./scripts/deploy.sh                  # imajları sunucuda derle (CI yoksa)
```

Mimari notlar:

- **Tek origin**: nginx hem frontend'i hem `/api` ve `/ws`'i aynı alan adı
  altında sunar. Bu CORS'u tamamen ortadan kaldırır ve refresh cookie'sinin
  `SameSite=Lax` ile sorunsuz çalışmasını sağlar. Dev'de Vite aynı işi
  proxy ile yapar, böylece iki ortam aynı şekilde davranır.
- **`COOKIE_SECURE=true` prod'da zorunlu** — aksi halde refresh cookie'si düz
  HTTP üzerinden de gönderilir.
- Backend imajı **katmanlı jar** kullanır: bağımlılıklar ayrı katmanda, kod
  değişiminde yalnızca küçük katman yeniden yüklenir. Konteyner **root
  olmayan** kullanıcıyla çalışır ve `HEALTHCHECK` tanımlıdır.
- `deploy.sh` deploy öncesi `.env` içindeki sırların placeholder olmadığını
  doğrular; yoksa üretim tahmin edilebilir bir JWT anahtarıyla çalışabilirdi.
- **nginx `/ws` için `proxy_read_timeout 3600s`** — varsayılan 60 saniye ile
  boşta duran STOMP bağlantıları sürekli kopar.
- **İmajlar CI'da derlenir**, sunucuda değil: `t3.small` 2 GB RAM'e sahip ve
  Maven + npm build'ini çalışan stack ile birlikte yapmak OOM riski taşır.

### Yerel Docker build ve TLS kesintisi

Antivirüs HTTPS'i kesiyorsa (bkz. Sorun Giderme) konteyner içindeki `npm` ve
`mvn` de paket indiremez — hata `UNABLE_TO_VERIFY_LEAF_SIGNATURE` olarak görünür
(npm 10 bunu yanıltıcı bir "Exit handler never called" mesajıyla gizler).
Sunucuda böyle bir kesinti olmadığı için Dockerfile'lara kalıcı bir çözüm
eklenmedi; yerelde denemek isterseniz kök sertifikayı build aşamasına geçici
olarak enjekte edin.

## Durum

Tüm aşamalar tamam:

- [x] Repo yapısı, `.gitignore`, `.env.example`
- [x] Dev altyapısı (Postgres, Redis, Mailpit)
- [x] Spring Boot iskeleti, güvenlik yapılandırması, health check
- [x] Flyway V1 — kullanıcı ve token şeması
- [x] Frontend kabuğu — ray, kanal paneli, sohbet, üye listesi, ses çubuğu
- [x] Phase 1 — kayıt, e-posta doğrulama, giriş, token rotasyonu, şifre sıfırlama, admin seed
- [x] Phase 2 — odalar, kanallar, davet kodu, üyelik ve sahiplik kontrolleri
- [x] Phase 3 — metin sohbeti (STOMP), keyset geçmiş, typing, düzenle/sil
- [x] Phase 4 — ses kanalları (WebRTC mesh, signaling, ekran paylaşımı, coturn)
- [x] Phase 5 — arkadaş sistemi, DM, presence
- [x] Phase 6 — Quick Match (oyun profilleri, kuyruk, eşleştirici, geçici oda)
- [x] Phase 7 — toast bildirimleri, gerçek diyaloglar, admin paneli
- [x] Phase 8 — prod Dockerfile'lar, nginx + TLS, coturn, deploy scriptleri, AWS runbook
