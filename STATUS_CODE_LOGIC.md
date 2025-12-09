# HTTP Status Code Mantığı - Expected Status Code Boş Olduğunda

## 📋 Genel Mantık

**Expected Status Code** alanı **boş bırakıldığında**, sistem HTTP status code'una göre otomatik olarak servis durumunu belirler.

## 🔍 Down Durumu Tespiti

Sistem aşağıdaki durumlarda servisi **DOWN** olarak işaretler:

### 1. HTTP Status Code 5xx (500-599)
- **500 Internal Server Error**
- **502 Bad Gateway**
- **503 Service Unavailable**
- **504 Gateway Timeout**
- vb.

**Örnek:** Sunucu hatası döndüğünde servis DOWN olur.

### 2. Network Hataları
- **Connection timeout** (timeout_ms süresi içinde yanıt alınamazsa)
- **DNS resolution failed** (domain çözümlenemezse)
- **SSL/TLS handshake failed** (SSL bağlantısı kurulamazsa)
- **Connection refused** (sunucu bağlantıyı reddederse)
- **Network unreachable** (ağa erişilemezse)

**Örnek:** `fetch()` exception fırlatırsa servis DOWN olur.

### 3. Expected Status Code Belirtilmişse
- Eğer **expected_status_code** belirtilmişse ve dönen status code farklıysa
- **Ancak:** 3xx redirect'ler normal kabul edilir (HTTP → HTTPS yönlendirmesi)

## ✅ UP Durumu

Sistem aşağıdaki durumlarda servisi **UP** olarak işaretler:

### 1. HTTP Status Code 2xx (200-299)
- **200 OK**
- **201 Created**
- **204 No Content**
- vb.

### 2. HTTP Status Code 3xx (300-399) - Redirects
- **301 Moved Permanently**
- **302 Found**
- **307 Temporary Redirect**
- **308 Permanent Redirect**
- vb.

**Not:** Redirect'ler normal kabul edilir (HTTP → HTTPS yönlendirmesi gibi).

## ⚠️ DEGRADED Durumu

Sistem aşağıdaki durumlarda servisi **DEGRADED** olarak işaretler:

### 1. HTTP Status Code 4xx (400-499)
- **400 Bad Request**
- **401 Unauthorized**
- **403 Forbidden**
- **404 Not Found**
- **429 Too Many Requests**
- vb.

**Not:** 4xx hataları client hatasıdır, sunucu çalışıyor ama istek geçersiz.

### 2. Response Time > 3000ms
- Yanıt süresi 3 saniyeyi geçerse servis DEGRADED olur
- Sunucu yanıt veriyor ama yavaş

## 📊 Özet Tablo

| Durum | HTTP Status Code | Açıklama |
|-------|------------------|----------|
| **UP** | 2xx (200-299) | Başarılı yanıt |
| **UP** | 3xx (300-399) | Redirect (normal) |
| **DEGRADED** | 4xx (400-499) | Client hatası (sunucu çalışıyor) |
| **DOWN** | 5xx (500-599) | Sunucu hatası |
| **DOWN** | Network Error | Bağlantı hatası, timeout, DNS hatası |

## 🔧 Kod Mantığı

```typescript
// Expected status code boş ise:
if (!expectedStatusCode) {
  // HTTP status code'una göre karar ver
  if (statusCode >= 500) {
    status = 'down';        // 5xx = DOWN
  } else if (statusCode >= 400) {
    status = 'degraded';    // 4xx = DEGRADED
  } else if (statusCode >= 300) {
    status = 'up';          // 3xx = UP (redirect)
  } else {
    status = 'up';          // 2xx = UP
  }
  
  // Response time kontrolü
  if (responseTime > 3000) {
    status = 'degraded';    // Yavaş yanıt = DEGRADED
  }
}

// Network hatası durumunda:
catch (error) {
  status = 'down';          // Exception = DOWN
}
```

## 💡 Örnek Senaryolar

### Senaryo 1: Normal Site
- **URL:** `https://example.com`
- **Response:** `200 OK`
- **Sonuç:** ✅ **UP**

### Senaryo 2: HTTP → HTTPS Redirect
- **URL:** `http://example.com`
- **Response:** `302 Found` → `https://example.com` → `200 OK`
- **Sonuç:** ✅ **UP** (redirect normal)

### Senaryo 3: 404 Not Found
- **URL:** `https://example.com/notfound`
- **Response:** `404 Not Found`
- **Sonuç:** ⚠️ **DEGRADED** (sunucu çalışıyor ama sayfa yok)

### Senaryo 4: Server Error
- **URL:** `https://example.com`
- **Response:** `500 Internal Server Error`
- **Sonuç:** ❌ **DOWN**

### Senaryo 5: Timeout
- **URL:** `https://example.com`
- **Response:** Timeout (5 saniye içinde yanıt yok)
- **Sonuç:** ❌ **DOWN**

### Senaryo 6: DNS Hatası
- **URL:** `https://nonexistent-domain-12345.com`
- **Response:** DNS resolution failed
- **Sonuç:** ❌ **DOWN**

## 🎯 Sonuç

**Expected Status Code boş bırakıldığında**, sistem:
- ✅ **2xx/3xx** → UP (servis çalışıyor)
- ⚠️ **4xx** → DEGRADED (sunucu çalışıyor ama client hatası)
- ❌ **5xx** → DOWN (sunucu hatası)
- ❌ **Network Error** → DOWN (bağlantı hatası)

Bu mantık, çoğu web servisi için yeterlidir. Özel durumlar için **Expected Status Code** alanını kullanabilirsiniz.

