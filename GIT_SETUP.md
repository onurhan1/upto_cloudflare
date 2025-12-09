# 🚀 Git Integration Kurulumu - Adım Adım

## ✅ Hazırlanan Dosyalar

1. ✅ `frontend/.gitignore` - Git ignore dosyası
2. ✅ `frontend/wrangler.toml` - Cloudflare Pages config
3. ✅ `frontend/package.json` - `cf-pages:build` script eklendi
4. ✅ `.github/workflows/deploy.yml` - GitHub Actions workflow (opsiyonel)

## 📋 Adım Adım Kurulum

### 1. GitHub Repository Oluştur

1. GitHub'a gidin: https://github.com/new
2. Repository adı: `upto-cloudflare` (veya istediğiniz isim)
3. **Public** veya **Private** seçin
4. **Initialize this repository with a README** seçeneğini **işaretlemeyin**
5. **Create repository**

### 2. Local Repository'yi Bağla

```bash
cd /Users/onurhany/Desktop/Uygulama\ Geliştirme/upto_cloudflare

# İlk commit
git add .
git commit -m "Initial commit: Upto Cloudflare platform"

# GitHub repository URL'inizi alın (örnek: https://github.com/username/upto-cloudflare.git)
# Remote ekleyin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push edin
git branch -M main
git push -u origin main
```

### 3. Cloudflare Dashboard'da Git Bağlantısı

1. **Cloudflare Dashboard**: https://dash.cloudflare.com
2. **Pages** > **upto-frontend** > **Settings**
3. **Builds & deployments** sekmesi
4. **Connect to Git** butonuna tıklayın
5. **GitHub** seçin ve authorize edin
6. Repository'nizi seçin: `upto-cloudflare` (veya oluşturduğunuz isim)
7. **Begin setup**

### 4. Build Ayarları

**Framework preset**: `None` (Custom)

**Build settings**:
```
Build command: cd frontend && npm install && npm run cf-pages:build
Build output directory: frontend/.vercel/output/static
Root directory: / (boş bırakın)
```

**Production branch**: `main`

### 5. Environment Variables

**Environment variables** bölümüne ekleyin:

| Variable name | Value |
|--------------|-------|
| `NEXT_PUBLIC_API_URL` | `https://upto-backend.onurhanyilmaz87.workers.dev` |

**Environment**: `Production` (veya `All environments`)

### 6. Deploy

**Save and Deploy** butonuna tıklayın!

İlk build başlayacak ve yaklaşık 2-5 dakika sürecek.

## ✅ Başarı Kontrolü

1. **Deployments** sekmesinde build durumunu takip edin
2. Build başarılı olduğunda ✅ işareti görünecek
3. Yeni deployment URL'i oluşturulacak
4. Frontend URL'ine gidin ve test edin

## 🔄 Otomatik Deploy

Artık her `git push` yaptığınızda Cloudflare Pages otomatik olarak:
1. Yeni kodu çekecek
2. Build yapacak
3. Deploy edecek

## 📝 Sonraki Adımlar

1. ✅ Git repository oluşturuldu
2. ⏳ GitHub'a push edin
3. ⏳ Cloudflare Dashboard'da Git bağlantısı yapın
4. ⏳ Build ayarlarını yapın
5. ⏳ Environment variables ekleyin
6. ⏳ İlk deploy'u başlatın

## 🐛 Sorun Giderme

### Build Başarısız

**Hata**: `@cloudflare/next-on-pages` not found
- **Çözüm**: `package.json`'da devDependency olarak ekli olduğundan emin olun

**Hata**: Next.js version mismatch  
- **Çözüm**: Next.js 15.4.8 kullanılıyor, bu uyumlu

### 404 Hatası

**Neden**: Build output directory yanlış
- **Çözüm**: `frontend/.vercel/output/static` olduğundan emin olun

### Connection Reset

**Neden**: Environment variable eksik
- **Çözüm**: `NEXT_PUBLIC_API_URL` set edildiğinden emin olun

## 📚 Detaylı Dokümantasyon

- `DEPLOYMENT_INSTRUCTIONS.md` - Detaylı deployment rehberi
- `CLOUDFLARE_PAGES_SETUP.md` - Cloudflare Pages setup detayları

