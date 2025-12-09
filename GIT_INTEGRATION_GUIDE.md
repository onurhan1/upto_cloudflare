# 🔗 Cloudflare Pages Git Integration - Doğru Yol

## ⚠️ Önemli: "Builds & deployments" Sekmesi Yoksa

Cloudflare Pages'de Git integration için **iki farklı yol** var:

### Yol 1: Create Deployment Butonundan (Önerilen)

1. **Pages proje sayfasına gidin:**
   https://dash.cloudflare.com/1b01171ad67364409ba073f8881f818f/pages/view/upto-frontend

2. **"Create deployment"** butonuna tıklayın (sağ üstte veya ana sayfada)

3. **"Connect to Git"** seçeneğini seçin

4. **GitHub** seçin ve authorize edin

5. Repository: **onurhan1/upto_cloudflare** seçin

6. Build ayarlarını yapın:
   - **Build command**: `cd frontend && npm install && npm run cf-pages:build`
   - **Build output directory**: `frontend/.vercel/output/static`
   - **Root directory**: `/` (boş)

7. **Deploy** butonuna tıklayın

### Yol 2: Yeni Proje Oluştur (Alternatif)

Eğer mevcut projede Git bağlantısı yapamıyorsanız:

1. **Pages** > **Create a project**

2. **"Connect to Git"** seçin

3. **GitHub** seçin ve authorize edin

4. Repository: **onurhan1/upto_cloudflare** seçin

5. **Project name**: `upto-frontend` (veya farklı bir isim)

6. Build ayarlarını yapın:
   - **Framework preset**: `None` (Custom)
   - **Build command**: `cd frontend && npm install && npm run cf-pages:build`
   - **Build output directory**: `frontend/.vercel/output/static`
   - **Root directory**: `/` (boş)

7. **Environment variables**:
   - `NEXT_PUBLIC_API_URL` = `https://upto-backend.onurhanyilmaz87.workers.dev`

8. **Save and Deploy**

### Yol 3: Settings Sayfasında (Eğer Varsa)

Bazı Cloudflare hesaplarında Settings sayfasında farklı sekmeler olabilir:

1. **Settings** sayfasına gidin
2. **"Configuration"** veya **"Build configuration"** sekmesine bakın
3. **"Connect Git repository"** veya benzer bir buton arayın

## 🔍 Hangi Yolu Kullanmalıyım?

- **Yol 1** en kolay ve önerilen yoldur
- Eğer "Create deployment" butonu görünmüyorsa **Yol 2**'yi kullanın
- Mevcut projeyi silip yeniden oluşturmak istemiyorsanız **Yol 3**'ü deneyin

## ✅ Kontrol

Git bağlantısı başarılı olduğunda:
- Proje sayfasında "Git Provider: GitHub" görünecek
- Her `git push` sonrası otomatik deploy başlayacak
- Deployments sekmesinde build logları görünecek

