# Otomatik Deploy (GitHub Actions)

`main` dalına her push'ta: testler koşar → imajlar GHCR'a itilir → sunucu yeni
imajları çeker. **Testler kırmızıysa deploy çalışmaz.**

```
push → main
  ├─ test    backend ./mvnw verify + frontend npm test/build
  ├─ build   backend/frontend imajları → ghcr.io  (latest + commit SHA)
  └─ deploy  SSH → sunucuda ./scripts/deploy.sh --pull
```

## Neden imajlar CI'da derleniyor?

`t3.small` 2 GB RAM'e sahip. Maven ve npm build'ini çalışan stack ile birlikte
sunucuda yapmak belleği zorlar ve OOM riski taşır. CI'da derleyip hazır imaj
çekmek bunu çözer; ayrıca her deploy commit SHA'sıyla etiketlendiği için geri
dönüş tek komut olur.

## Kurulum

### 1. Sunucuda deploy anahtarı

```bash
# SUNUCUDA
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

cat ~/.ssh/github_deploy        # PRIVATE key — DEPLOY_SSH_KEY secret'ı olacak
ssh-keyscan -H "$(curl -s ifconfig.me)"   # DEPLOY_HOST_KEY secret'ı olacak
```

> Private key'i kopyaladıktan sonra sunucudan silin: `rm ~/.ssh/github_deploy`
> Public key `authorized_keys` içinde kaldığı için erişim devam eder.

### 2. GitHub secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Değer |
|---|---|
| `DEPLOY_HOST` | EC2 Elastic IP |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | `~/.ssh/github_deploy` içeriği (private key, tamamı) |
| `DEPLOY_HOST_KEY` | `ssh-keyscan` çıktısı |

`DEPLOY_HOST_KEY` neden gerekli: her çalışmada `ssh-keyscan` yapmak, sunucuya
"ilk görüşte güven" demektir ve MITM'e açık kalır. Host anahtarını sabitlemek
bu riski kapatır.

### 3. Sunucuda GHCR erişimi

Paket private ise sunucunun registry'ye giriş yapması gerekir. GitHub'da
Settings → Developer settings → Personal access tokens → Fine-grained,
yalnızca `read:packages` yetkisiyle bir token üretin:

```bash
# SUNUCUDA
echo "<TOKEN>" | docker login ghcr.io -u <github-kullanici-adin> --password-stdin
```

Giriş `~/.docker/config.json` içinde kalır; bir kez yapmak yeterli.

> Paketi public yaparsanız (GitHub → Packages → Package settings → Change
> visibility) bu adıma gerek kalmaz.

### 4. `.env` içinde imaj adları

```
BACKEND_IMAGE=ghcr.io/teomangvn/gameteams-backend:latest
FRONTEND_IMAGE=ghcr.io/teomangvn/gameteams-frontend:latest
```

GHCR imaj adları küçük harf olmalıdır; workflow repo adını otomatik küçültür.

### 5. İlk deploy

İlk deploy'da da imajları **sunucuda derlemeyin** — OOM riski ilk seferde de
geçerli. Sıra şöyle:

```bash
# 1) GitHub'da workflow'u elle tetikle:
#    Actions → "Test, Build & Deploy" → Run workflow
#    (veya main'e herhangi bir push)
#    Bu adım imajları GHCR'a iter.

# 2) SUNUCUDA — hazır imajları çek
cd /opt/gameteams
git checkout main
./scripts/deploy.sh --pull
```

Secrets'ı 2. adımdan önce tanımladıysanız workflow zaten deploy'u kendisi
yapar; sunucuda elle bir şey çalıştırmanıza gerek kalmaz.

Bundan sonra `main`'e push yeterli.

> `./scripts/deploy.sh` (--pull'suz) imajları sunucuda derler. Yalnızca CI
> kullanılamadığında veya hata ayıklarken gerekir.

## Deploy sırasında ne oluyor

`deploy.sh --pull`:

1. `.env` içindeki sırların placeholder olmadığını doğrular
2. `git reset --hard origin/main` — compose, nginx şablonu ve coturn ayarları
   repodan gelir (`.env` ve sertifikalar takip edilmediği için korunur)
3. Veritabanı yedeği alır
4. Yeni imajları çeker, `up -d --no-build` ile başlatır
5. Sağlık kontrolü yapar; 5 dakika içinde `UP` olmazsa backend loglarını
   basıp hata ile çıkar
6. Bir haftadan eski imajları temizler

Flyway migration'ları backend açılışında otomatik uygulanır.

## Geri dönüş

Her imaj commit SHA'sı ile de etiketlenir:

```bash
# SUNUCUDA — bilinen iyi bir sürüme dön
IMAGE_TAG=a1b2c3d4e5f6 ./scripts/deploy.sh --pull
```

SHA'yı Actions çalışmasının "Imaj adlarini hazirla" adımından veya GHCR paket
sayfasından alabilirsiniz.

Şema değişikliği içeren bir sürümden geri dönüyorsanız yalnızca imaj yeterli
olmaz; Flyway geri alma yapmaz. O durumda deploy öncesi alınan yedeği geri
yükleyin.

## Sorun giderme

**Deploy adımı `Permission denied (publickey)`** — public key `authorized_keys`
içinde mi, `DEPLOY_USER` doğru mu (`ubuntu`), private key secret'ına
`-----BEGIN...` ve `-----END...` satırları dahil mi kontrol edin.

**`Host key verification failed`** — Elastic IP değişmiş olabilir;
`DEPLOY_HOST_KEY` secret'ını yeniden üretin.

**`denied: permission_denied` (pull sırasında)** — sunucuda `docker login
ghcr.io` yapılmamış veya token'ın `read:packages` yetkisi yok.

**Testler CI'da kırmızı ama yerelde yeşil** — `BackendApplicationTests` yerelde
Docker Desktop uyumsuzluğu nedeniyle atlanıyor, CI'da gerçekten koşuyor.
Runner'daki hata gerçektir.
