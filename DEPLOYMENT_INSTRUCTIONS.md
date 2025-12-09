# 🚀 Cloudflare Pages Git Integration - Hızlı Kurulum

## ⚡ Hızlı Başlangıç

### 1. Cloudflare Dashboard'da Git Bağlantısı

1. **Cloudflare Dashboard** > **Pages** > **upto-frontend** > **Settings**
2. **Builds & deployments** sekmesi
3. **Connect to Git** butonuna tıklayın
4. GitHub repository'nizi seçin ve authorize edin

### 2. Build Ayarları

**Framework preset**: `None` (Custom)

**Build settings**:
```
Build command: cd frontend && npm install && npm run cf-pages:build
Build output directory: frontend/.vercel/output/static
Root directory: /
```

### 3. Environment Variables

**Environment variables** bölümüne ekleyin:
```
NEXT_PUBLIC_API_URL = https://upto-backend.onurhanyilmaz87.workers.dev
```

### 4. Deploy

**Save and Deploy** butonuna tıklayın. İlk build başlayacak!

## 📝 Detaylı Adımlar

### Adım 1: Repository'yi Hazırlayın

```bash
cd /Users/onurhany/Desktop/Uygulama\ Geliştirme/upto_cloudflare

# Değişiklikleri commit edin
git add .
git commit -m "Add Cloudflare Pages configuration"

# GitHub'a push edin (eğer remote yoksa önce ekleyin)
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Adım 2: Cloudflare Dashboard Ayarları

1. **Pages** > **upto-frontend** > **Settings** > **Builds & deployments**
2. **Connect to Git** > Repository seçin
3. **Build configuration**:
   - **Production branch**: `main` (veya `master`)
   - **Framework preset**: `None`
   - **Build command**: 
     ```bash
     cd frontend && npm install && npm run cf-pages:build
     ```
   - **Build output directory**: 
     ```
     frontend/.vercel/output/static
     ```
   - **Root directory**: `/` (boş bırakın veya `/`)

4. **Environment variables**:
   - **Variable name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://upto-backend.onurhanyilmaz87.workers.dev`
   - **Environment**: `Production` (veya `All environments`)

5. **Save and Deploy**

### Adım 3: İlk Deploy

Cloudflare Pages otomatik olarak:
1. Repository'den kodu çekecek
2. Build komutunu çalıştıracak
3. Output'u deploy edecek

Build loglarını **Deployments** sekmesinden takip edebilirsiniz.

## 🔧 Build Komutu Detayları

`npm run cf-pages:build` komutu şunları yapar:

1. `npm run build` - Next.js production build
2. `npx @cloudflare/next-on-pages` - Cloudflare Pages formatına dönüştürür
3. Output: `.vercel/output/static` klasörüne yazar

## ✅ Başarı Kontrolü

Deploy tamamlandıktan sonra:

1. **Deployments** sekmesinde yeşil ✅ işareti görünmeli
2. Frontend URL'ine gidin: `https://upto-frontend.pages.dev` (veya custom domain)
3. Sayfa açılmalı ve backend'e bağlanabilmeli

## 🐛 Sorun Giderme

### Build Başarısız

**Hata**: `@cloudflare/next-on-pages` not found
- **Çözüm**: `package.json`'da `@cloudflare/next-on-pages` devDependency olarak ekli olduğundan emin olun

**Hata**: Next.js version mismatch
- **Çözüm**: Next.js 15.4.8 kullanılıyor, bu uyumlu. Eğer hata alırsanız `--legacy-peer-deps` ekleyin

### 404 Hatası

**Neden**: Build output directory yanlış
- **Çözüm**: `frontend/.vercel/output/static` olduğundan emin olun

**Neden**: Environment variable eksik
- **Çözüm**: `NEXT_PUBLIC_API_URL` set edildiğinden emin olun

### Connection Reset

**Neden**: Backend URL yanlış
- **Çözüm**: `NEXT_PUBLIC_API_URL` environment variable'ını kontrol edin

## 📚 Ek Kaynaklar

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)

