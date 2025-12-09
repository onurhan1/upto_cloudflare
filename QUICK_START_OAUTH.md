# 🚀 Hızlı OAuth Kurulumu

## Google OAuth için Gerekli Bilgiler

Google OAuth'u çalıştırmak için şu bilgilere ihtiyacım var:

1. **Google Client ID** - Google Cloud Console'dan alınacak
2. **Google Client Secret** - Google Cloud Console'dan alınacak

## Otomatik Kurulum Scripti

```bash
./scripts/setup-oauth.sh
```

Bu script size adım adım yardımcı olacak.

## Manuel Kurulum

### 1. Google Cloud Console'da OAuth Oluşturma

1. https://console.cloud.google.com/ adresine gidin
2. Yeni proje oluşturun veya mevcut projeyi seçin
3. Sol menüden **APIs & Services** > **Credentials** seçin
4. **+ CREATE CREDENTIALS** > **OAuth client ID** tıklayın
5. **Application type**: Web application seçin
6. **Name**: Upto OAuth (veya istediğiniz bir isim)
7. **Authorized redirect URIs** bölümüne ekleyin:
   ```
   http://localhost:8787/oauth/google/callback
   ```
8. **CREATE** butonuna tıklayın
9. **Client ID** ve **Client Secret** değerlerini kopyalayın

### 2. Credentials'ları Ekleme

`backend/wrangler.local.toml` dosyasını düzenleyin:

```toml
[vars]
GOOGLE_CLIENT_ID = "your-client-id-here"
GOOGLE_CLIENT_SECRET = "your-client-secret-here"
```

### 3. Backend'i Yeniden Başlatma

```bash
cd backend
wrangler dev --port 8787 --local --config wrangler.local.toml
```

## Test Modu (Development)

Eğer Google OAuth credentials'ları yoksa, development modunda otomatik olarak mock (test) OAuth çalışır. Sadece Google butonuna tıklayın, otomatik olarak test kullanıcısı oluşturulur ve giriş yaparsınız.

## Production için

Production'da mutlaka gerçek Google OAuth credentials kullanın:

```bash
cd backend
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

