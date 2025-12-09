# Upto Platform - Mevcut Özellikler

## 📋 Genel Bakış

Upto, Cloudflare ekosistemi üzerinde çalışan tam özellikli bir **Uptime Monitoring + Incident Management + Status Page + Alerting** platformudur. Platform %100 Cloudflare servisleri kullanılarak geliştirilmiştir.

---

## 🔐 1. Kimlik Doğrulama ve Kullanıcı Yönetimi

### 1.1 Email/Password Authentication
- ✅ **Kayıt Olma (Register)**
  - Email, şifre ve isim ile yeni kullanıcı oluşturma
  - SHA-256 ile şifre hashleme
  - Otomatik default integration oluşturma
  - JWT token döndürme

- ✅ **Giriş Yapma (Login)**
  - Email ve şifre ile giriş
  - Şifre doğrulama
  - JWT token üretimi
  - Kullanıcı bilgileri döndürme

### 1.2 OAuth Authentication
- ✅ **Google OAuth**
  - Google ile giriş yapma
  - OAuth 2.0 flow implementasyonu
  - Otomatik kullanıcı oluşturma (ilk girişte)
  - JWT token üretimi
  - Development mode için mock OAuth desteği

- ✅ **Apple Sign In**
  - Apple ile giriş yapma
  - OAuth flow implementasyonu
  - Kullanıcı oluşturma ve token üretimi

### 1.3 Kullanıcı Rolleri
- ✅ **Rol Sistemi**
  - `admin`: Tam yetki
  - `user`: Standart kullanıcı
  - `readonly`: Sadece okuma yetkisi

### 1.4 JWT Token Management
- ✅ Web Crypto API ile JWT imzalama/doğrulama
- ✅ HMAC-SHA256 algoritması
- ✅ Token expiration kontrolü
- ✅ Middleware ile otomatik doğrulama

---

## 📊 2. Servis İzleme (Service Monitoring)

### 2.1 Servis Yönetimi
- ✅ **Servis Listeleme**
  - Kullanıcıya ait tüm servisleri listeleme
  - Oluşturulma tarihine göre sıralama

- ✅ **Servis Detayları**
  - Servis bilgileri
  - Son 50 health check sonucu
  - Açık incident'ler

- ✅ **Servis Oluşturma**
  - Servis adı, tipi, URL/host
  - Port numarası (opsiyonel)
  - Check interval (varsayılan: 60 saniye)
  - Timeout (varsayılan: 5000ms)
  - Beklenen status code
  - Beklenen keyword
  - Telegram/Email bildirim ayarları

- ✅ **Servis Güncelleme**
  - Tüm servis parametrelerini güncelleme
  - Aktif/pasif durumu değiştirme

- ✅ **Servis Silme**
  - Soft delete (is_active = 0)

### 2.2 Servis Tipleri
- ✅ **HTTP/HTTPS Monitoring**
  - URL kontrolü
  - Status code doğrulama
  - Keyword kontrolü
  - Response time ölçümü

- ✅ **API Monitoring**
  - REST API endpoint kontrolü
  - Response validation

- ✅ **Ping Monitoring**
  - Host erişilebilirlik kontrolü
  - (Şu an HTTP check olarak implement edilmiş)

- ✅ **DNS Monitoring**
  - DNS çözümleme kontrolü
  - (Şu an HTTP check olarak implement edilmiş)

- ✅ **SSL Monitoring**
  - SSL sertifika kontrolü
  - (Şu an HTTP check olarak implement edilmiş)

- ✅ **Domain Monitoring**
  - Domain erişilebilirlik kontrolü
  - (Şu an HTTP check olarak implement edilmiş)

### 2.3 Health Check Sistemi
- ✅ **Otomatik Health Check**
  - Cron trigger ile dakikada bir çalışma
  - Tüm aktif servisleri queue'ya ekleme
  - Check interval'e göre kontrol

- ✅ **Manuel Health Check**
  - `/services/:id/test` endpoint'i
  - Anında health check tetikleme

- ✅ **Health Check Sonuçları**
  - Status: `up`, `down`, `degraded`
  - Response time (ms)
  - HTTP status code
  - Error message
  - Check timestamp

### 2.4 Durum Yönetimi
- ✅ **KV Snapshot Storage**
  - Her servis için son durum KV'de saklanıyor
  - 24 saat TTL
  - Hızlı erişim için cache

- ✅ **Durable Objects State**
  - Her servis için ayrı Durable Object
  - Real-time state tracking
  - Son 20 check sonucu saklanıyor
  - Flapping detection için veri

- ✅ **Database Storage**
  - Tüm check sonuçları D1'de saklanıyor
  - Geçmiş veri analizi için

---

## 🚨 3. Incident Management

### 3.1 Incident Yönetimi
- ✅ **Incident Listeleme**
  - Tüm incident'leri listeleme
  - Service ID'ye göre filtreleme
  - Status'e göre filtreleme (open, monitoring, resolved)
  - Son 100 incident

- ✅ **Incident Detayları**
  - Incident bilgileri
  - Tüm update'ler (zaman sırasına göre)
  - Servis adı bilgisi

- ✅ **Incident Oluşturma**
  - Manuel incident oluşturma
  - Başlık ve açıklama
  - Status: `open`, `monitoring`, `resolved`
  - Otomatik ilk update oluşturma

- ✅ **Incident Güncelleme**
  - Status değiştirme
  - Başlık ve açıklama güncelleme
  - Yeni update ekleme
  - Otomatik resolved_at timestamp

### 3.2 Otomatik Incident Yönetimi
- ✅ **Otomatik Incident Oluşturma**
  - Servis down olduğunda otomatik incident oluşturma
  - "Service is down" başlığı
  - "investigating" status ile ilk update

- ✅ **Otomatik Incident Çözme**
  - Servis up olduğunda otomatik çözme
  - Status'ü "resolved" yapma
  - "Service is back up" update'i
  - Resolved_at timestamp

### 3.3 Incident Update'leri
- ✅ **Update Tipleri**
  - `investigating`: Sorun araştırılıyor
  - `identified`: Sorun tespit edildi
  - `monitoring`: İyileştirme uygulanıyor
  - `resolved`: Sorun çözüldü

---

## 📈 4. Uptime Hesaplama

- ✅ **Uptime Yüzdeleri**
  - 24 saatlik uptime
  - 7 günlük uptime
  - 30 günlük uptime
  - Her 5 dakikada bir otomatik hesaplama

- ✅ **Uptime Storage**
  - KV'de cache'leniyor
  - 1 saat TTL
  - Status page'lerde kullanılıyor

---

## 📄 5. Status Page (Durum Sayfaları)

### 5.1 Status Page Yönetimi
- ✅ **Status Page Listeleme**
  - Kullanıcıya ait tüm status page'leri

- ✅ **Status Page Oluşturma**
  - Unique slug
  - Başlık ve açıklama
  - Public/Private ayarı
  - Tema seçimi: `light`, `dark`, `auto`

- ✅ **Status Page Güncelleme**
  - Başlık, açıklama güncelleme
  - Public/Private değiştirme
  - Tema değiştirme

- ✅ **Status Page Silme**
  - Hard delete

- ✅ **Servis Ekleme**
  - Status page'e servis ekleme
  - Display order belirleme
  - Duplicate kontrolü

### 5.2 Public Status Page
- ✅ **Public API Endpoint**
  - `/public/status/:slug` endpoint'i
  - Authentication gerektirmiyor
  - KV cache kullanıyor

- ✅ **Status Page İçeriği**
  - Status page bilgileri
  - Tüm servisler ve durumları
  - Son incident'ler
  - Uptime yüzdeleri (24h, 7d, 30d)

- ✅ **Cache Sistemi**
  - KV'de cache'leniyor
  - Hızlı yanıt için

---

## 🔔 6. Bildirimler (Notifications)

### 6.1 Telegram Entegrasyonu
- ✅ **Telegram Bot**
  - Webhook endpoint: `/telegram/webhook`
  - Bot token ile authentication

- ✅ **Telegram Komutları**
  - `/start`: Hoş geldin mesajı ve komut listesi
  - `/services`: Kullanıcının servislerini listeleme
  - `/status <service_id>`: Servis durumunu gösterme
  - `/incidents`: Açık incident'leri listeleme

- ✅ **Telegram Bildirimleri**
  - Servis down olduğunda otomatik bildirim
  - Servis up olduğunda recovery bildirimi
  - Chat ID ile kullanıcı eşleştirme

- ✅ **Telegram Integration Yönetimi**
  - Chat ID kaydetme
  - Aktif/pasif yapma

### 6.2 Email Bildirimleri
- ✅ **MailChannels Entegrasyonu**
  - MailChannels API kullanımı
  - HTML/Text email desteği

- ✅ **Email Bildirimleri**
  - Servis down olduğunda email gönderme
  - Servis up olduğunda recovery email
  - Özelleştirilebilir email adresi

- ✅ **Email Integration Yönetimi**
  - Email adresi kaydetme
  - Aktif/pasif yapma

### 6.3 Bildirim Ayarları
- ✅ **Servis Bazında Bildirim**
  - Her servis için ayrı Telegram/Email ayarı
  - Bildirimleri açma/kapatma

---

## 🔧 7. Entegrasyonlar (Integrations)

### 7.1 Integration Yönetimi
- ✅ **Integration Listeleme**
  - Kullanıcının integration ayarları
  - Otomatik oluşturma (yoksa)

- ✅ **Telegram Integration**
  - Chat ID güncelleme
  - Aktif/pasif yapma

- ✅ **Email Integration**
  - Email adresi güncelleme
  - Aktif/pasif yapma

---

## 📦 8. R2 Object Storage

### 8.1 Dosya Yönetimi
- ✅ **Dosya Yükleme**
  - `/r2/upload` endpoint'i
  - FormData ile dosya yükleme
  - Kullanıcı bazlı klasör yapısı: `users/{user_id}/{filename}`
  - Content-Type otomatik belirleme
  - Metadata kaydetme

- ✅ **Dosya İndirme**
  - `/r2/download/:key` endpoint'i
  - Content-Type header'ı
  - Inline görüntüleme

- ✅ **Dosya Listeleme**
  - `/r2/list` endpoint'i
  - Kullanıcıya ait tüm dosyalar
  - Dosya boyutu ve upload tarihi

- ✅ **Dosya Silme**
  - `/r2/:key` DELETE endpoint'i
  - Ownership kontrolü
  - Sadece kendi dosyalarını silebilme

---

## 🎯 9. Monitoring Engine

### 9.1 Cron Triggers
- ✅ **Dakikada Bir Çalışma**
  - Tüm aktif servisleri queue'ya ekleme
  - Check interval kontrolü

- ✅ **5 Dakikada Bir Uptime Hesaplama**
  - Tüm servisler için uptime yüzdeleri
  - KV'ye kaydetme

### 9.2 Queue System
- ✅ **Cloudflare Queues**
  - Health check job'larını queue'ya ekleme
  - Batch processing
  - Retry mekanizması

- ✅ **Queue Consumer**
  - Her mesajı işleme
  - Health check yapma
  - Sonuçları kaydetme
  - Incident logic çalıştırma

### 9.3 Health Check Logic
- ✅ **HTTP Check**
  - URL'ye GET request
  - Timeout kontrolü
  - Status code doğrulama
  - Keyword kontrolü
  - Response time ölçümü
  - Degraded status (yavaş yanıt için)

### 9.4 Flapping Detection
- ✅ **Durable Objects ile Flapping**
  - Son 5 dakikadaki state değişikliklerini takip
  - 3+ state değişikliği = flapping
  - False positive'leri önleme

---

## 🎨 10. Frontend (Next.js)

### 10.1 Sayfalar
- ✅ **Ana Sayfa** (`/`)
  - Login/Register linkleri

- ✅ **Giriş Sayfası** (`/login`)
  - Email/Password girişi
  - Google OAuth butonu
  - Apple Sign In butonu
  - OAuth callback handling

- ✅ **Kayıt Sayfası** (`/register`)
  - Email, şifre, isim ile kayıt
  - Google OAuth butonu
  - Apple Sign In butonu

- ✅ **OAuth Callback** (`/auth/callback`)
  - Token alma ve kaydetme
  - Dashboard'a yönlendirme

- ✅ **Dashboard** (`/dashboard`)
  - Servis özetleri
  - Incident özetleri
  - Genel durum

- ✅ **Servisler** (`/services`)
  - Servis listesi
  - Yeni servis ekleme butonu

- ✅ **Yeni Servis** (`/services/new`)
  - Servis oluşturma formu

- ✅ **Servis Detayı** (`/services/[id]`)
  - Servis bilgileri
  - Health check sonuçları
  - Incident'ler

- ✅ **Incident'ler** (`/incidents`)
  - Incident listesi
  - Filtreleme

- ✅ **Incident Detayı** (`/incidents/[id]`)
  - Incident bilgileri
  - Update'ler
  - Status değiştirme

- ✅ **Status Page'ler** (`/status-pages`)
  - Status page listesi
  - Yeni status page oluşturma

- ✅ **Yeni Status Page** (`/status-pages/new`)
  - Status page oluşturma formu

- ✅ **Public Status Page** (`/s/[slug]`)
  - Public status page görüntüleme
  - Servis durumları
  - Incident'ler
  - Uptime yüzdeleri

### 10.2 UI/UX
- ✅ **TailwindCSS** ile styling
- ✅ **Shadcn/UI** component library
- ✅ Responsive tasarım
- ✅ Modern ve temiz arayüz

---

## 🗄️ 11. Veritabanı (D1)

### 11.1 Tablolar
- ✅ **users**: Kullanıcı bilgileri
- ✅ **monitored_services**: İzlenen servisler
- ✅ **service_checks**: Health check sonuçları
- ✅ **incidents**: Incident'ler
- ✅ **incident_updates**: Incident güncellemeleri
- ✅ **integrations**: Entegrasyon ayarları
- ✅ **status_pages**: Status page'ler
- ✅ **status_page_services**: Status page - servis ilişkisi

### 11.2 Indexes
- ✅ Performance için optimize edilmiş indexler
- ✅ Foreign key constraints
- ✅ Unique constraints

---

## 🔒 12. Güvenlik

### 12.1 Authentication
- ✅ JWT token authentication
- ✅ HMAC-SHA256 ile imzalama
- ✅ Token expiration
- ✅ Middleware ile otomatik doğrulama

### 12.2 Authorization
- ✅ Role-based access control
- ✅ Kullanıcı bazlı veri izolasyonu
- ✅ Ownership kontrolü

### 12.3 CORS
- ✅ CORS middleware
- ✅ Cross-origin request kontrolü

### 12.4 Password Security
- ✅ SHA-256 hash
- ✅ Web Crypto API kullanımı

---

## 📝 13. API Endpoints Özeti

### Public Endpoints
- `GET /` - API bilgileri
- `GET /health` - Health check
- `POST /auth/register` - Kayıt
- `POST /auth/login` - Giriş
- `GET /oauth/google` - Google OAuth başlat
- `GET /oauth/google/callback` - Google OAuth callback
- `GET /oauth/apple` - Apple OAuth başlat
- `POST /oauth/apple/callback` - Apple OAuth callback
- `GET /public/status/:slug` - Public status page
- `POST /telegram/webhook` - Telegram webhook

### Protected Endpoints
- `GET /users/me` - Kullanıcı bilgileri
- `GET /services` - Servis listesi
- `GET /services/:id` - Servis detayı
- `POST /services` - Servis oluştur
- `PATCH /services/:id` - Servis güncelle
- `DELETE /services/:id` - Servis sil
- `POST /services/:id/test` - Manuel health check
- `GET /incidents` - Incident listesi
- `GET /incidents/:id` - Incident detayı
- `POST /incidents` - Incident oluştur
- `PATCH /incidents/:id` - Incident güncelle
- `GET /status-page/mine` - Status page listesi
- `GET /status-page/:id` - Status page detayı
- `POST /status-page` - Status page oluştur
- `PATCH /status-page/:id` - Status page güncelle
- `DELETE /status-page/:id` - Status page sil
- `POST /status-page/:id/services` - Servis ekle
- `GET /integrations` - Integration ayarları
- `PATCH /integrations/telegram` - Telegram ayarları
- `PATCH /integrations/email` - Email ayarları
- `POST /r2/upload` - Dosya yükle
- `GET /r2/download/:key` - Dosya indir
- `GET /r2/list` - Dosya listele
- `DELETE /r2/:key` - Dosya sil

---

## 🚀 14. Cloudflare Servisleri

### 14.1 Kullanılan Servisler
- ✅ **Cloudflare Workers**: API ve monitoring engine
- ✅ **Cloudflare D1**: SQL veritabanı
- ✅ **Cloudflare KV**: Cache ve snapshot storage
- ✅ **Cloudflare Durable Objects**: Real-time state management
- ✅ **Cloudflare Queues**: Job queue system
- ✅ **Cloudflare Cron Triggers**: Scheduled tasks
- ✅ **Cloudflare R2**: Object storage
- ✅ **Cloudflare Pages**: Frontend hosting
- ✅ **MailChannels**: Email gönderimi
- ✅ **Telegram Bot API**: Telegram bildirimleri

---

## 📊 15. Özellik Durumu

### ✅ Tamamlanan Özellikler
- [x] Authentication (Email/Password, Google, Apple)
- [x] Service Monitoring (HTTP, API, Ping, DNS, SSL, Domain)
- [x] Health Check System
- [x] Incident Management
- [x] Status Page
- [x] Telegram Integration
- [x] Email Integration
- [x] R2 File Storage
- [x] Uptime Calculation
- [x] Flapping Detection
- [x] Frontend Pages
- [x] API Endpoints

### 🔄 Geliştirilmesi Gerekenler
- [ ] DNS check gerçek implementasyonu
- [ ] SSL check gerçek implementasyonu
- [ ] Ping check gerçek implementasyonu
- [ ] Rate limiting
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Frontend form validasyonları
- [ ] Error handling iyileştirmeleri
- [ ] Logging sistemi
- [ ] Analytics ve metrikler

---

## 🎯 Sonuç

Upto platformu, temel özelliklerin çoğunu içeren, production-ready bir monitoring ve incident management sistemidir. Cloudflare ekosisteminin tüm güçlü özelliklerini kullanarak ölçeklenebilir ve hızlı bir platform sunmaktadır.

