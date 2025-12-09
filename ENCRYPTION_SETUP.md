# API Key Encryption Setup

## 🔐 Güvenlik

API key'ler artık **AES-GCM 256-bit** şifreleme ile güvenli bir şekilde saklanıyor.

## 🚀 Production Setup

### 1. Encryption Key Oluşturma

Production'da kullanmak için bir encryption key oluşturun:

```bash
# Node.js ile encryption key oluştur
node -e "
const crypto = require('crypto');
const key = crypto.randomBytes(32);
console.log('ENCRYPTION_KEY=' + key.toString('base64'));
"
```

Veya Cloudflare Workers'da:

```typescript
import { generateEncryptionKey } from './utils/encryption';
const key = await generateEncryptionKey();
console.log(key); // Bu key'i ENCRYPTION_KEY olarak saklayın
```

### 2. Cloudflare Workers Secrets

Production'da encryption key'i Cloudflare Workers Secrets olarak ekleyin:

```bash
# Cloudflare Workers Secrets'e ekle
wrangler secret put ENCRYPTION_KEY
# Key'i yapıştırın (base64 encoded)
```

### 3. Local Development

Local development için `wrangler.local.toml` dosyasına ekleyin:

```toml
[vars]
ENCRYPTION_KEY = "your-base64-encoded-key-here"
```

**⚠️ ÖNEMLİ:** Local development key'i production'da KULLANMAYIN!

## 🔄 Migration (Mevcut Plain Text Key'ler)

Sistem otomatik olarak eski plain text key'leri algılar ve şifreler:

1. Key okunurken decrypt edilmeye çalışılır
2. Eğer decrypt başarısız olursa ve key `sk-` veya `claude-` ile başlıyorsa:
   - Plain text olarak kullanılır (backward compatibility)
   - Otomatik olarak şifrelenir ve veritabanına kaydedilir
   - Bir sonraki okumada artık şifreli olarak kullanılır

## 📝 Kullanım

### API Key Kaydetme

```typescript
// Backend otomatik olarak şifreler
PUT /settings/api-keys/openai
{
  "apiKey": "sk-..."
}
```

### API Key Okuma

```typescript
// Backend otomatik olarak şifre çözer
const apiKey = await getUserApiKey(db, userId, 'openai', env);
```

## 🔒 Güvenlik Özellikleri

- **AES-GCM 256-bit**: Endüstri standardı şifreleme
- **Random IV**: Her şifreleme için unique IV (Initialization Vector)
- **Base64 Encoding**: Güvenli veri transferi için
- **Environment-based Key**: Encryption key environment variable'dan alınır
- **Backward Compatibility**: Eski plain text key'ler otomatik migrate edilir

## ⚠️ Güvenlik Notları

1. **ENCRYPTION_KEY'i asla commit etmeyin** (Git'e eklemeyin)
2. **Her environment için farklı key kullanın** (dev, staging, production)
3. **Key'i düzenli olarak rotate edin** (yılda bir kez önerilir)
4. **Key'i güvenli bir şekilde saklayın** (password manager, secrets manager)
5. **Production'da default key'i kullanmayın**

## 🛠️ Troubleshooting

### "Failed to decrypt data" Hatası

- ENCRYPTION_KEY doğru mu? (base64 formatında olmalı)
- Key değişti mi? (Eski key ile şifrelenmiş key'ler yeni key ile decrypt edilemez)
- Key formatı doğru mu? (32 byte = 256 bit, base64 encoded)

### Key Rotation

Eğer encryption key'i değiştirmeniz gerekiyorsa:

1. Yeni key oluşturun
2. Tüm API key'leri yeniden kaydedin (kullanıcılar Settings'ten güncelleyebilir)
3. Veya migration script'i yazın (tüm key'leri decrypt edip yeni key ile encrypt edin)

## 📚 Teknik Detaylar

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits
- **IV Size**: 12 bytes (96 bits)
- **Encoding**: Base64
- **Format**: `[IV (12 bytes)][Encrypted Data]` → Base64

