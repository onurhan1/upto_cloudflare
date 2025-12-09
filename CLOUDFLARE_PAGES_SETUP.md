# Cloudflare Pages Git Integration Setup

## Adım 1: Cloudflare API Token Oluştur

1. Cloudflare Dashboard'a gidin: https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** butonuna tıklayın
3. **Edit Cloudflare Workers** template'ini seçin
4. **Account Resources** altında:
   - Account: `upto-frontend` seçin
   - Zone Resources: Gerekli değil
5. **Continue to summary** > **Create Token**
6. Token'ı kopyalayın (bir daha gösterilmeyecek!)

## Adım 2: GitHub Repository Secrets Ekle

GitHub repository'nize gidin ve **Settings > Secrets and variables > Actions** bölümüne gidin:

1. **CLOUDFLARE_API_TOKEN**: Adım 1'de oluşturduğunuz token
2. **CLOUDFLARE_ACCOUNT_ID**: Cloudflare Dashboard > Sağ üst köşedeki Account ID
3. **NEXT_PUBLIC_API_URL**: `https://upto-backend.onurhanyilmaz87.workers.dev` (opsiyonel, zaten workflow'da var)

## Adım 3: Cloudflare Dashboard'da Git Integration

1. Cloudflare Dashboard > **Pages** > **upto-frontend** > **Settings**
2. **Builds & deployments** sekmesine gidin
3. **Connect to Git** butonuna tıklayın
4. GitHub repository'nizi seçin ve authorize edin
5. **Build settings**:
   - **Framework preset**: `Next.js (Static HTML Export)` veya `None`
   - **Build command**: `cd frontend && npm run cf-pages:build`
   - **Build output directory**: `frontend/.vercel/output/static`
   - **Root directory**: `/` (veya repository root)
6. **Environment variables**:
   - `NEXT_PUBLIC_API_URL` = `https://upto-backend.onurhanyilmaz87.workers.dev`
7. **Save and Deploy**

## Alternatif: Manuel Git Push ile Deploy

Eğer GitHub Actions kullanmak istemiyorsanız:

```bash
# Repository'yi commit ve push edin
git add .
git commit -m "Configure Cloudflare Pages deployment"
git push origin main

# Cloudflare Dashboard'dan otomatik deploy başlayacak
```

## Build Komutları

Cloudflare Pages build sırasında şu komutları çalıştıracak:

```bash
cd frontend
npm install
npm run cf-pages:build
```

Bu komut:
1. Next.js build yapar
2. `@cloudflare/next-on-pages` ile Cloudflare Pages formatına dönüştürür
3. `.vercel/output/static` klasörüne output verir

## Troubleshooting

### Build Hatası
- `@cloudflare/next-on-pages` versiyonunu kontrol edin
- Next.js versiyonunun uyumlu olduğundan emin olun (14.3.0 - 15.5.2)

### 404 Hatası
- Build output directory'nin doğru olduğundan emin olun: `frontend/.vercel/output/static`
- Environment variables'ın set edildiğinden emin olun

### Environment Variables
- `NEXT_PUBLIC_API_URL` mutlaka set edilmeli
- Cloudflare Dashboard > Pages > Settings > Environment variables

