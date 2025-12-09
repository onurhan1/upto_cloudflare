# AI Summary - Veri Kaynakları ve Oluşturulma Süreci

## 📊 Veri Kaynakları

AI Summary, aşağıdaki verilerden beslenir:

### 1. **Service Bilgileri**
- Service adı (`service.name`)
- Service URL/Host (`service.url_or_host`)

### 2. **Incident Bilgileri**
- Incident başlığı (`incidentTitle`)
- Incident açıklaması (`incidentDescription`)

### 3. **Health Check Geçmişi** (Son 20 check'ten 10 tanesi)
- **Status**: `up`, `down`, `degraded`
- **Response Time**: Milisaniye cinsinden yanıt süresi
- **Status Code**: HTTP status code (örn: 200, 404, 500)
- **Error Message**: Hata mesajı (varsa)
- **Anomaly Detection**: 
  - `anomaly_detected`: boolean
  - `anomaly_type`: `spike`, `slowdown`, `unknown`
  - `anomaly_score`: Z-score değeri

## 🔄 Oluşturulma Süreci

### Ne Zaman Oluşturulur?
1. **Yeni Incident Oluşturulduğunda**:
   - Service `down` durumuna geçtiğinde
   - Service `degraded` durumuna geçtiğinde
   - İlk kez bir incident açıldığında

### Nasıl Çalışır?
1. **Incident oluşturulur** (senkron)
2. **AI Summary oluşturulur** (asenkron - incident oluşturmayı bloklamaz)
3. **OpenAI API'ye gönderilir**:
   - Model: `gpt-4o-mini` (maliyet optimizasyonu için)
   - Temperature: `0.3` (daha tutarlı sonuçlar için)
   - Max Tokens: `500`
4. **Sonuç veritabanına kaydedilir** (`incidents.ai_summary` kolonuna)

## 📝 AI Summary Formatı

AI Summary, aşağıdaki JSON formatında döner:

```json
{
  "summary": "Brief summary of the incident (2-3 sentences)",
  "rootCause": "Most likely root cause based on the data",
  "affectedSystems": ["List of affected systems/components"],
  "recommendedActions": ["Action 1", "Action 2", "Action 3"]
}
```

## ⚙️ Konfigürasyon

### OpenAI API Key Gereksinimi

AI Summary özelliğini kullanmak için `OPENAI_API_KEY` environment variable'ı gereklidir.

#### Local Development (`wrangler.local.toml`):
```toml
[vars]
OPENAI_API_KEY = "sk-..." # OpenAI API key'inizi buraya ekleyin
```

#### Production (`wrangler.toml`):
```toml
[vars]
OPENAI_API_KEY = "sk-..." # Cloudflare Workers Secrets kullanın
```

### OpenAI API Key Nasıl Alınır?

1. https://platform.openai.com/api-keys adresine gidin
2. Giriş yapın
3. "Create new secret key" butonuna tıklayın
4. Key'i kopyalayın ve `wrangler.local.toml` dosyasına ekleyin

### API Key Olmadan Ne Olur?

- AI Summary oluşturulmaz
- Incident normal şekilde oluşturulur
- Frontend'de "AI Summary not available" mesajı gösterilir
- Sistem çalışmaya devam eder (AI Summary opsiyonel bir özelliktir)

## 🔍 Kod Akışı

### 1. Incident Oluşturma (`backend/src/utils/incidents.ts`)

```typescript
// Yeni incident oluşturulduğunda
if (status === 'down' && !openIncident) {
  // Son 20 check'i al
  const recentChecks = await db
    .prepare('SELECT * FROM service_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 20')
    .bind(serviceId)
    .all();

  // AI Summary'yi asenkron oluştur
  (async () => {
    const aiSummary = await generateIncidentSummary(
      incidentId,
      service.name,
      service.url_or_host,
      `${service.name} is down`,
      `Service ${service.name} is currently down.`,
      recentChecks.results || [],
      env
    );

    // Veritabanına kaydet
    if (aiSummary) {
      await db
        .prepare('UPDATE incidents SET ai_summary = ? WHERE id = ?')
        .bind(aiSummary, incidentId)
        .run();
    }
  })();
}
```

### 2. AI Summary Generation (`backend/src/utils/ai.ts`)

```typescript
export async function generateIncidentSummary(
  incidentId: string,
  serviceName: string,
  serviceUrl: string,
  incidentTitle: string,
  incidentDescription: string | null,
  recentChecks: Array<{...}>,
  env: Env
): Promise<string | null> {
  // OpenAI API key kontrolü
  if (!env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, skipping AI summary generation');
    return null;
  }

  // Health check geçmişini formatla
  const checkHistory = recentChecks.slice(0, 10).map((check) => ({
    status: check.status,
    responseTime: check.response_time_ms,
    statusCode: check.status_code,
    error: check.error_message,
    timestamp: new Date(check.checked_at * 1000).toISOString(),
    anomaly: check.anomaly_detected ? check.anomaly_type : null,
  }));

  // OpenAI API'ye istek gönder
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a technical incident analysis assistant...',
        },
        {
          role: 'user',
          content: prompt, // Service, incident ve check history bilgileri
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  // JSON response'u parse et ve döndür
  // ...
}
```

## 🎯 Frontend'de Gösterim

AI Summary, Incident Detail sayfasında (`/incidents/[id]`) "AI Summary" tab'ında gösterilir:

- **Summary**: Olay özeti
- **Root Cause**: Muhtemel kök neden
- **Affected Systems**: Etkilenen sistemler listesi
- **Recommended Actions**: Önerilen aksiyonlar

Eğer AI Summary henüz oluşturulmamışsa veya API key yoksa:
- "AI Summary not available" mesajı gösterilir
- "AI summary has not been generated yet. It will be created automatically when the incident is analyzed." açıklaması gösterilir

## 💰 Maliyet

- **Model**: `gpt-4o-mini` (maliyet optimizasyonu için seçildi)
- **Max Tokens**: 500 (her summary için)
- **Tahmini Maliyet**: ~$0.00015 per summary (gpt-4o-mini pricing'e göre)

## 🔧 Troubleshooting

### AI Summary oluşturulmuyor

1. **OpenAI API Key kontrolü**:
   ```bash
   # Backend loglarını kontrol et
   tail -f /tmp/wrangler.log | grep -i "openai\|ai summary"
   ```

2. **API Key doğru mu?**:
   - `wrangler.local.toml` dosyasında `OPENAI_API_KEY` var mı?
   - Key formatı doğru mu? (`sk-...` ile başlamalı)

3. **Backend yeniden başlatıldı mı?**:
   - Environment variable değişiklikleri için backend'i yeniden başlatın

4. **OpenAI API limiti**:
   - API key'inizde yeterli kredi var mı?
   - Rate limit'e takıldınız mı?

### AI Summary boş geliyor

- OpenAI API'den hata dönüyor olabilir
- Backend loglarını kontrol edin: `tail -f /tmp/wrangler.log`
- OpenAI API dashboard'unu kontrol edin: https://platform.openai.com/usage

