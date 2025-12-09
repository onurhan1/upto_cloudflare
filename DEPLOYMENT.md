# Upto Production Deployment Guide

Bu doküman, Upto platformunu Cloudflare Workers ve Pages üzerinde production'a almak için adım adım rehberdir.

## Ön Gereksinimler

1. Cloudflare hesabı (ücretsiz plan yeterli)
2. Cloudflare Workers ve Pages aktif
3. Wrangler CLI kurulu (`npm install -g wrangler`)
4. Cloudflare hesabına login (`wrangler login`)

## Deployment Adımları

### 1. Cloudflare Hesabına Login

```bash
cd backend
wrangler login
```

### 2. D1 Database Oluşturma

```bash
# Production database
wrangler d1 create upto-db

# Çıktıdaki database_id'yi wrangler.toml'a ekleyin
```

### 3. KV Namespaces Oluşturma

```bash
# Status snapshots
wrangler kv:namespace create STATUS_SNAPSHOTS

# Status page cache
wrangler kv:namespace create STATUS_PAGE_CACHE

# Rate limit store
wrangler kv:namespace create RATE_LIMIT_STORE

# Her birinin id'sini wrangler.toml'a ekleyin
```

### 4. Durable Objects Oluşturma

Durable Objects otomatik olarak Worker ile birlikte oluşturulur. Sadece wrangler.toml'da tanımlı olması yeterli.

### 5. Queues Oluşturma

```bash
wrangler queues create monitoring-queue
```

### 6. R2 Bucket Oluşturma

```bash
wrangler r2 bucket create upto-static-assets
```

### 7. Production Secrets Set Etme

```bash
# JWT Secret (güçlü bir secret oluşturun)
wrangler secret put JWT_SECRET

# Telegram Bot Token
wrangler secret put TELEGRAM_BOT_TOKEN

# MailChannels API Key (opsiyonel)
wrangler secret put MAILCHANNELS_API_KEY

# Encryption Key (32 byte base64)
wrangler secret put ENCRYPTION_KEY

# OAuth Secrets (eğer kullanıyorsanız)
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put APPLE_PRIVATE_KEY
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_TEAM_ID
```

### 8. Production Environment Variables

`wrangler.toml` dosyasında production environment variables'ları ayarlayın:

```toml
[vars]
ENVIRONMENT = "production"
FRONTEND_URL = "https://your-frontend-domain.com"
FROM_EMAIL = "noreply@yourdomain.com"
```

### 9. Migration'ları Çalıştırma

```bash
# Migration'ları production database'e uygula
wrangler d1 execute upto-db --file=../infrastructure/migrations/0001_initial_schema.sql
wrangler d1 execute upto-db --file=../infrastructure/migrations/0002_add_anomaly_and_ai.sql
wrangler d1 execute upto-db --file=../infrastructure/migrations/0003_add_user_api_keys.sql
wrangler d1 execute upto-db --file=../infrastructure/migrations/0004_add_multitenancy.sql
wrangler d1 execute upto-db --file=../infrastructure/migrations/0005_add_audit_logs.sql
wrangler d1 execute upto-db --file=../infrastructure/migrations/0006_query_optimization.sql
```

### 10. Backend Worker Deploy

```bash
cd backend
wrangler deploy
```

### 11. Frontend Build ve Deploy

```bash
cd frontend

# Environment variable ayarla
export NEXT_PUBLIC_API_URL=https://upto-backend.your-account.workers.dev

# Build
npm run build

# Cloudflare Pages'e deploy
# Cloudflare Dashboard > Pages > Create Project > Upload files
# veya wrangler pages deploy kullanın
```

### 12. Test ve Doğrulama

1. Backend health check: `https://upto-backend.your-account.workers.dev/health`
2. Frontend erişim: `https://your-frontend.pages.dev`
3. Login/Register test
4. Service oluşturma test
5. Monitoring test

## Önemli Notlar

- **JWT_SECRET**: Production'da mutlaka güçlü bir secret kullanın
- **ENCRYPTION_KEY**: 32 byte base64 encoded key (openssl rand -base64 32)
- **FRONTEND_URL**: Frontend domain'inizi doğru ayarlayın (CORS için)
- **FROM_EMAIL**: MailChannels için doğrulanmış email domain kullanın
- **Database Backup**: Düzenli backup almayı unutmayın

## Troubleshooting

- **CORS Errors**: FRONTEND_URL'in doğru ayarlandığından emin olun
- **Database Errors**: Migration'ların doğru çalıştığını kontrol edin
- **Secret Errors**: Tüm secrets'ların set edildiğini kontrol edin

