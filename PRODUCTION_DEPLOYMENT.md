# 🚀 Upto Production Deployment - Adım Adım Rehber

Bu rehber, Upto platformunu Cloudflare Workers ve Pages üzerinde production'a almak için tüm adımları içerir.

## 📋 Ön Gereksinimler

1. ✅ Cloudflare hesabı (ücretsiz plan yeterli)
2. ✅ Wrangler CLI kurulu: `npm install -g wrangler`
3. ✅ Cloudflare hesabına login: `wrangler login`

## 🔧 Adım 1: Cloudflare'e Login

```bash
cd backend
wrangler login
```

Browser açılacak, Cloudflare hesabınızla giriş yapın.

## 🗄️ Adım 2: D1 Database Oluştur

```bash
cd backend
wrangler d1 create upto-db
```

**Çıktıdan `database_id`'yi kopyalayın ve `backend/wrangler.toml` dosyasına ekleyin:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "upto-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Buraya yapıştırın
```

## 📦 Adım 3: KV Namespaces Oluştur

```bash
# Status Snapshots
wrangler kv:namespace create STATUS_SNAPSHOTS

# Status Page Cache
wrangler kv:namespace create STATUS_PAGE_CACHE

# Rate Limit Store
wrangler kv:namespace create RATE_LIMIT_STORE
```

**Her birinin çıktısından `id`'yi kopyalayın ve `backend/wrangler.toml` dosyasına ekleyin:**

```toml
[[kv_namespaces]]
binding = "STATUS_SNAPSHOTS"
id = "YOUR_KV_ID_HERE"  # ← Buraya yapıştırın

[[kv_namespaces]]
binding = "STATUS_PAGE_CACHE"
id = "YOUR_KV_ID_HERE"  # ← Buraya yapıştırın

[[kv_namespaces]]
binding = "RATE_LIMIT_STORE"
id = "YOUR_KV_ID_HERE"  # ← Buraya yapıştırın
```

## 🔄 Adım 4: Queue Oluştur

```bash
wrangler queues create monitoring-queue
```

## 💾 Adım 5: R2 Bucket Oluştur

```bash
wrangler r2 bucket create upto-static-assets
```

## 🔐 Adım 6: Secrets Set Et

Production için güvenli secrets oluşturun:

```bash
# JWT Secret (güçlü bir secret - örnek: openssl rand -hex 32)
wrangler secret put JWT_SECRET
# Değer girin: (örnek: a1b2c3d4e5f6...)

# Telegram Bot Token
wrangler secret put TELEGRAM_BOT_TOKEN
# Değer girin: 8232306252:AAG1KqehRIGpPjxzcGclqMgcQWZuMSQktYg

# Encryption Key (32 byte base64)
# Önce key oluşturun: openssl rand -base64 32
wrangler secret put ENCRYPTION_KEY
# Oluşturduğunuz key'i girin

# MailChannels API Key (opsiyonel - email göndermek için)
wrangler secret put MAILCHANNELS_API_KEY
# API key'inizi girin veya boş bırakın

# OAuth Secrets (eğer kullanıyorsanız)
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put APPLE_PRIVATE_KEY
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_TEAM_ID
```

## 📝 Adım 7: Production Environment Variables

`backend/wrangler.toml` dosyasını güncelleyin:

```toml
[vars]
ENVIRONMENT = "production"
FRONTEND_URL = "https://your-frontend.pages.dev"  # Frontend URL'iniz
FROM_EMAIL = "noreply@yourdomain.com"  # Doğrulanmış email domain
```

**Not:** Frontend URL'ini henüz bilmiyorsanız, deploy sonrası güncelleyebilirsiniz.

## 🗃️ Adım 8: Database Migration'ları Çalıştır

```bash
cd infrastructure/migrations

# Tüm migration'ları sırayla çalıştırın
wrangler d1 execute upto-db --file=0001_initial_schema.sql
wrangler d1 execute upto-db --file=0002_add_anomaly_and_ai.sql
wrangler d1 execute upto-db --file=0003_add_user_api_keys.sql
wrangler d1 execute upto-db --file=0004_add_multitenancy.sql
wrangler d1 execute upto-db --file=0005_add_audit_logs.sql
wrangler d1 execute upto-db --file=0006_query_optimization.sql

cd ../../backend
```

## 🚀 Adım 9: Backend Worker Deploy

```bash
cd backend
wrangler deploy
```

Deploy başarılı olursa, Worker URL'inizi alacaksınız:
```
https://upto-backend.YOUR_ACCOUNT.workers.dev
```

**Bu URL'i not edin - frontend için gerekli!**

## 🌐 Adım 10: Frontend Deploy (Cloudflare Pages)

### Seçenek 1: Cloudflare Dashboard (Önerilen)

1. Cloudflare Dashboard'a gidin: https://dash.cloudflare.com
2. **Pages** > **Create a project**
3. **Upload assets** seçin
4. Frontend'i build edin:

```bash
cd frontend

# Environment variable ayarlayın
export NEXT_PUBLIC_API_URL=https://upto-backend.YOUR_ACCOUNT.workers.dev

# Build
npm run build

# .next klasörünü ve diğer gerekli dosyaları seçin
```

5. **Build output directory:** `.next`
6. **Framework preset:** Next.js
7. **Root directory:** `/`
8. Deploy edin

### Seçenek 2: Wrangler Pages (CLI)

```bash
cd frontend

# Environment variable
export NEXT_PUBLIC_API_URL=https://upto-backend.YOUR_ACCOUNT.workers.dev

# Build
npm run build

# Deploy
wrangler pages deploy .next --project-name=upto-frontend
```

## ✅ Adım 11: Frontend URL'ini Backend'e Ekle

Frontend deploy edildikten sonra URL'inizi alın (örn: `https://upto-frontend.pages.dev`)

`backend/wrangler.toml` dosyasını güncelleyin:

```toml
[vars]
FRONTEND_URL = "https://upto-frontend.pages.dev"  # ← Frontend URL'iniz
```

Sonra backend'i yeniden deploy edin:

```bash
cd backend
wrangler deploy
```

## 🧪 Adım 12: Test ve Doğrulama

1. **Backend Health Check:**
   ```bash
   curl https://upto-backend.YOUR_ACCOUNT.workers.dev/health
   ```
   Beklenen: `{"status":"ok","service":"upto-api"}`

2. **Frontend Erişim:**
   - Frontend URL'inize gidin
   - Login/Register sayfası görünmeli

3. **Fonksiyon Testleri:**
   - ✅ Yeni kullanıcı kaydı
   - ✅ Login
   - ✅ Servis oluşturma
   - ✅ Health check çalışması
   - ✅ Telegram bildirimleri

## 🔍 Troubleshooting

### CORS Hatası
- `FRONTEND_URL`'in doğru ayarlandığından emin olun
- Backend'i yeniden deploy edin

### Database Hatası
- Migration'ların doğru çalıştığını kontrol edin:
  ```bash
  wrangler d1 execute upto-db --command="SELECT name FROM sqlite_master WHERE type='table'"
  ```

### Secret Hatası
- Tüm secrets'ların set edildiğini kontrol edin:
  ```bash
  wrangler secret list
  ```

### Frontend Build Hatası
- `NEXT_PUBLIC_API_URL` environment variable'ının set edildiğinden emin olun
- Build log'larını kontrol edin

## 📊 Monitoring

Production'da monitoring için:
- Cloudflare Dashboard > Workers > upto-backend > Logs
- Cloudflare Dashboard > Pages > upto-frontend > Logs

## 🔄 Güncelleme Süreci

Kod güncellemeleri için:

```bash
# Backend
cd backend
wrangler deploy

# Frontend
cd frontend
npm run build
# Cloudflare Pages otomatik deploy edecek veya manuel upload
```

## 📝 Önemli Notlar

- ⚠️ **JWT_SECRET**: Production'da mutlaka güçlü bir secret kullanın
- ⚠️ **ENCRYPTION_KEY**: 32 byte base64 encoded key (güvenli saklayın)
- ⚠️ **Database Backup**: Düzenli backup almayı unutmayın
- ⚠️ **Rate Limits**: Cloudflare Workers ücretsiz planında günlük 100,000 request limiti var
- ⚠️ **D1 Limits**: Ücretsiz plan 5GB storage, 5M reads/day, 100K writes/day

## 🎉 Başarılı Deployment!

Tüm adımlar tamamlandığında, Upto platformunuz production'da çalışıyor olacak!

