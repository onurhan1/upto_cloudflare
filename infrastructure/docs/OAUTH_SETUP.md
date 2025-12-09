# OAuth Setup Guide

Bu dokümantasyon Google ve Apple OAuth entegrasyonunu nasıl yapılandıracağınızı açıklar.

## Google OAuth Setup

### 1. Google Cloud Console'da Proje Oluşturma

1. [Google Cloud Console](https://console.cloud.google.com/)'a gidin
2. Yeni bir proje oluşturun veya mevcut bir projeyi seçin
3. **APIs & Services** > **Credentials** bölümüne gidin
4. **Create Credentials** > **OAuth client ID** seçin
5. Application type olarak **Web application** seçin
6. Authorized redirect URIs ekleyin:
   - Development: `http://localhost:8787/oauth/google/callback`
   - Production: `https://your-worker.workers.dev/oauth/google/callback`

### 2. Client ID ve Secret'i Alma

1. Oluşturulan OAuth client'dan **Client ID** ve **Client Secret**'i kopyalayın
2. Bu değerleri Cloudflare Workers secrets olarak ayarlayın:

```bash
cd backend
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

### 3. Local Development için

`wrangler.local.toml` dosyasına ekleyin:

```toml
[vars]
GOOGLE_CLIENT_ID = "your-client-id"
GOOGLE_CLIENT_SECRET = "your-client-secret"
```

## Apple Sign In Setup

### 1. Apple Developer Account

1. [Apple Developer](https://developer.apple.com/) hesabınıza giriş yapın
2. **Certificates, Identifiers & Profiles** bölümüne gidin
3. **Identifiers** > **Services IDs** oluşturun
4. **Sign in with Apple** özelliğini etkinleştirin

### 2. Key Oluşturma

1. **Keys** bölümüne gidin
2. Yeni bir key oluşturun
3. **Sign in with Apple** seçeneğini işaretleyin
4. Key'i indirin (.p8 dosyası)
5. **Key ID**'yi not edin

### 3. Team ID ve Client ID

1. **Membership** bölümünden **Team ID**'nizi bulun
2. Oluşturduğunuz **Services ID**'yi **Client ID** olarak kullanın

### 4. Secrets Ayarlama

```bash
cd backend
wrangler secret put APPLE_CLIENT_ID
wrangler secret put APPLE_TEAM_ID
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_PRIVATE_KEY  # .p8 dosyasının içeriği
```

### 5. Redirect URI Ayarlama

Apple Developer Console'da:
- **Return URLs** bölümüne ekleyin:
  - Development: `http://localhost:8787/oauth/apple/callback`
  - Production: `https://your-worker.workers.dev/oauth/apple/callback`

## Frontend Configuration

Frontend'de API URL'ini ayarlayın:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8787  # Development
# NEXT_PUBLIC_API_URL=https://your-worker.workers.dev  # Production
```

## Test Etme

1. Backend'i başlatın:
   ```bash
   cd backend
   wrangler dev --local --config wrangler.local.toml
   ```

2. Frontend'i başlatın:
   ```bash
   cd frontend
   npm run dev
   ```

3. `http://localhost:3000/login` adresine gidin
4. Google veya Apple butonuna tıklayın
5. OAuth akışını tamamlayın

## Notlar

- **Google OAuth**: Tam olarak çalışır, production-ready
- **Apple Sign In**: Temel implementasyon mevcut, production için JWT imzalama (ES256) tam olarak implement edilmelidir
- OAuth kullanıcıları için password hash boş bırakılır
- İlk OAuth girişinde otomatik olarak kullanıcı oluşturulur

