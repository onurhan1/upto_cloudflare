# 🚀 Cloudflare Dashboard - Git Integration (2 Dakika)

## ⚡ Hızlı Adımlar

### 1. Cloudflare Dashboard'a Gidin
https://dash.cloudflare.com/1b01171ad67364409ba073f8881f818f/pages/view/upto-frontend

### 2. Settings > Builds & deployments
- Sol menüden **Settings** sekmesine tıklayın
- **Builds & deployments** bölümüne gidin

### 3. Connect to Git
- **Connect to Git** butonuna tıklayın
- **GitHub** seçin
- Authorize edin (gerekirse GitHub'a login olun)
- Repository seçin: **onurhan1/upto_cloudflare**

### 4. Build Configuration
**Production branch**: `main`

**Build settings**:
- **Framework preset**: `None` (Custom)
- **Build command**: 
  ```
  cd frontend && npm install && npm run cf-pages:build
  ```
- **Build output directory**: 
  ```
  frontend/.vercel/output/static
  ```
- **Root directory**: `/` (boş bırakın)

### 5. Environment Variables
Zaten set edildi: `NEXT_PUBLIC_API_URL` = `https://upto-backend.onurhanyilmaz87.workers.dev`

### 6. Save and Deploy
- **Save and Deploy** butonuna tıklayın
- İlk build başlayacak (2-5 dakika)

## ✅ Tamamlandı!

Artık her `git push` yaptığınızda otomatik deploy olacak!

