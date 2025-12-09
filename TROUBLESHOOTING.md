# Troubleshooting Guide - "Failed to Fetch" Hatası

## Sorun
Platforma giriş yapılamıyor ve "failed to fetch" hatası alınıyor.

## Çözüm Adımları

### 1. Backend'in Çalıştığını Kontrol Edin

```bash
cd backend
npx wrangler dev --port 8787 --config wrangler.local.toml
```

Backend çalışıyorsa şu çıktıyı görmelisiniz:
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### 2. Backend Health Check

```bash
curl http://localhost:8787/health
```

Şu yanıtı almalısınız:
```json
{"status":"ok","service":"upto-api"}
```

### 3. Frontend'in Çalıştığını Kontrol Edin

```bash
cd frontend
npm run dev
```

Frontend çalışıyorsa şu çıktıyı görmelisiniz:
```
- ready started server on 0.0.0.0:3000
```

### 4. API URL Yapılandırması

Frontend'in `next.config.js` dosyasında API URL doğru olmalı:
```javascript
env: {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
}
```

### 5. CORS Ayarları

Backend'de CORS middleware `http://localhost:3000` origin'ini destekliyor olmalı.

### 6. Rate Limiting Sorunları

Rate limiting middleware hata verirse, request'ler fail-open olarak çalışır (request'e izin verilir).

### 7. Browser Console'u Kontrol Edin

Browser'da F12'ye basıp Console sekmesinde hata mesajlarını kontrol edin.

## Yaygın Hatalar ve Çözümleri

### "Failed to fetch"
- Backend çalışmıyor olabilir → Backend'i başlatın
- CORS sorunu olabilir → CORS middleware'i kontrol edin
- Network sorunu olabilir → Firewall/proxy ayarlarını kontrol edin

### "401 Unauthorized"
- Token geçersiz veya süresi dolmuş → Tekrar giriş yapın
- JWT_SECRET yanlış yapılandırılmış → wrangler.local.toml'u kontrol edin

### "429 Too Many Requests"
- Rate limit aşıldı → Birkaç saniye bekleyin

### "500 Internal Server Error"
- Backend loglarını kontrol edin
- Database bağlantısını kontrol edin
- Environment variables'ı kontrol edin

## Hızlı Test

```bash
# Terminal 1: Backend
cd backend
npx wrangler dev --port 8787 --config wrangler.local.toml

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Test
curl http://localhost:8787/health
curl http://localhost:3000
```

## Düzeltilen Sorunlar

1. ✅ Logger'da `process.env` kullanımı kaldırıldı (Cloudflare Workers'da çalışmıyor)
2. ✅ Rate limiting middleware fail-open yapıldı (hata durumunda request'e izin verir)
3. ✅ Rate limiting D1 fallback'i try-catch ile korundu

