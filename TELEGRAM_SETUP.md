# Telegram Entegrasyonu Kurulumu

Telegram bildirimlerini kullanmak için iki adım gereklidir:

## 1. Bot Token (Backend'de ayarlanmalı)

### Adımlar:
1. Telegram'da [@BotFather](https://t.me/BotFather) ile konuşun
2. `/newbot` komutunu gönderin
3. Bot'unuz için bir isim seçin
4. Bot'unuz için bir username seçin (örn: `upto_monitoring_bot`)
5. BotFather size bir **Bot Token** verecek (örn: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Backend'e Ekleme:

**Local Development için (`wrangler.local.toml`):**
```toml
[vars]
TELEGRAM_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
```

**Production için (Cloudflare Dashboard veya `wrangler.toml`):**
```toml
[vars]
TELEGRAM_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
```

Veya Cloudflare Dashboard'dan:
1. Workers & Pages > Your Worker > Settings > Variables
2. `TELEGRAM_BOT_TOKEN` adında bir environment variable ekleyin
3. Bot Token'ınızı değer olarak girin

## 2. Chat ID (Frontend'den girilir)

### Adımlar:
1. Telegram'da [@userinfobot](https://t.me/userinfobot) ile konuşun
2. Bot size **Chat ID**'nizi verecek (örn: `825687705`)
3. Bu Chat ID'yi frontend'deki Integrations sayfasına girin
4. "Enable Telegram notifications" checkbox'ını işaretleyin
5. "Save Telegram Settings" butonuna tıklayın

## Test Etme

Bir servis oluşturup "Test" butonuna tıklayarak bildirimlerin çalışıp çalışmadığını test edebilirsiniz. Servis "down" durumuna geçtiğinde Telegram'dan bildirim almalısınız.

## Sorun Giderme

- **Bildirim gelmiyor?**
  - Backend'de `TELEGRAM_BOT_TOKEN` environment variable'ının doğru ayarlandığından emin olun
  - Chat ID'nin doğru girildiğinden emin olun
  - "Enable Telegram notifications" checkbox'ının işaretli olduğundan emin olun
  - Backend loglarını kontrol edin (console.error mesajları)

- **Bot Token bulamıyorum?**
  - @BotFather'a `/token` komutunu gönderin
  - Veya `/mybots` > Bot'unuzu seçin > API Token

- **Chat ID bulamıyorum?**
  - @userinfobot'a herhangi bir mesaj gönderin
  - Bot size Chat ID'nizi verecektir

