# 📊 KPI Dashboard — Sergi Sunum Rehberi

> **30 saniyelik tanım:** Sporthink e-ticaret firmasının Meta Ads, Google Ads, GA4 ve sipariş verilerini tek panelde birleştirip; ciro, ROAS, AOV, kâr gibi KPI'ları gösteren, içinde Gemini AI asistanı bulunan rol bazlı bir yönetim paneli. Veri CSV/XLSX import ile gelir, MySQL'de saklanır, Redis ile hızlandırılır.

---

## 1. TEKNOLOJİ YIĞINI (Stack)

| Katman | Teknoloji | Neden? |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | Modern, hızlı build, hot reload |
| **Grafikler** | ApexCharts | Esnek, etkileşimli grafikler |
| **Router/State** | React Router 7 + Context API | Hafif, ekstra kütüphaneye gerek yok |
| **HTTP** | Axios + Interceptor | Token, hata yönetimi tek yerde |
| **Backend** | Node.js + Express | Yaygın, hızlı geliştirme |
| **Veritabanı** | MySQL 8 | İlişkisel, raporlama dostu |
| **Cache** | Redis | KPI sorgularını 1 saat cache'le |
| **AI** | Google Gemini 2.5 Flash | Function calling ile veriyi sorgulatma |
| **Auth** | JWT (24 saat) | Stateless, ölçeklenebilir |
| **Reverse Proxy** | Caddy | HTTPS ve domain routing |
| **Konteyner** | Docker + docker-compose | Tek komutla deploy |

---

## 2. KLASÖR YAPISI

```
/backend
  /src
    server.js              ← Express başlatma, middleware zinciri
    /config
      database.js          ← MySQL connection pool (20 bağlantı)
      redis.js             ← Redis client
      logger.js            ← Winston log (console + dosya)
    /middleware
      auth.js              ← JWT doğrulama, kullanıcı çekme
      permissions.js       ← Rol/yetki kontrolü
      caching.js           ← Redis cache wrapper
    /lib
      permissions.js       ← Rol → izin haritası
    /routes                ← HTTP endpoint'leri (URL → fonksiyon)
      auth.js              ← Login, kullanıcı CRUD
      import.js            ← Dosya yükleme + import
      kpi.js               ← KPI hesaplamaları (25+ endpoint)
      data.js              ← Ham tablo verisi + temizleme
      filters.js           ← Filtre seçenekleri (kanal, marka...)
      reports.js           ← Excel rapor üretimi
      chat.js              ← Gemini AI uç noktası
    /services              ← İş mantığı (DB sorguları)
      kpiService.js        ← KPI SQL'leri (ciro, ROAS, funnel...)
      importService.js     ← CSV/XLSX parse + DB insert
      chatService.js       ← Gemini + tool çağrıları

/frontend
  /src
    main.jsx               ← React giriş
    App.jsx                ← Routing + ProtectedRoute + PermissionRoute
    /context
      AuthContext.jsx      ← user, token, login/logout
      FilterContext.jsx    ← Tarih, kanal, marka filtreleri
    /components
      Layout.jsx           ← Sidebar + header
      DataTable.jsx        ← Yeniden kullanılabilir tablo (sort, search)
      FilterBar.jsx        ← Üst filtre çubuğu
      ChatWidget.jsx       ← Sağ-alt AI asistan balonu
      ErrorBoundary.jsx    ← Sayfa çökünce kullanıcıya açıklayıcı ekran
      HelpTooltip.jsx      ← Soru işareti yardım baloncuğu
    /pages                 ← Her dosya 1 ekran
      Login.jsx, Overview.jsx, CampaignsOverview.jsx,
      ProductsOverview.jsx, PlatformsOverview.jsx,
      DecisionCenter.jsx, Reports.jsx, Import.jsx,
      Users.jsx, Profile.jsx
    /services
      api.js               ← Axios instance + tüm API metotları
    /lib
      permissions.js       ← Frontend yetki helper'ları

/database                  ← İlk şema + örnek veri SQL
/scripts                   ← Yardımcı script'ler
docker-compose.yml         ← Geliştirme ortamı (MySQL + Redis + backend + frontend)
docker-compose.production.yml ← Üretim ortamı
Caddyfile                  ← HTTPS reverse proxy
```

---

## 3. VERİTABANI ŞEMASI (14 Tablo)

| Tablo | Ne Tutuyor |
|---|---|
| `users` | Kullanıcılar; rol (admin/marketing/viewer) + özel izinler (JSON) |
| `import_logs` | Her import işleminin geçmişi (status: pending/processing/completed/failed) |
| `import_errors` | Satır bazında import hataları |
| `ga4_traffic` | GA4 trafiği — kanal, oturum, kullanıcı, dönüşüm |
| `ga4_item_interactions` | GA4 ürün etkileşimleri — view, add_to_cart, purchase |
| `meta_ads` | Meta (Facebook+Instagram) kampanya/adset/ad performansı |
| `meta_ads_breakdowns` | Meta platform/cihaz/yaş kırılımları |
| `google_ads` | Google Ads kampanya/ad_group performansı |
| `orders` | Sipariş başlığı — order_id, tarih, ciro, kanal, müşteri |
| `order_items` | Sipariş satırları — sku, adet, fiyat |
| `products` | Ürün master — sku, marka, kategori, maliyet, stok |
| `customers` | Müşteri master — cohort, lifetime value |
| `campaigns` | Kampanya master — platform, objective, bütçe |
| `channel_mapping` | source+medium → kanal grubu eşleme |

**Önemli not:** Tüm SQL sorguları **parametreli** (mysql2 prepared statements). SQL injection'a karşı güvenli.

---

## 4. BACKEND AKIŞI — Bir İsteğin Hayatı

Örnek: `GET /api/kpi/summary?startDate=20250301&endDate=20250331`

```
Browser → Caddy (HTTPS) → Express
     ↓
[1] helmet      → güvenlik header'ları (XSS, clickjacking)
[2] CORS        → frontend domain'inden geliyor mu?
[3] rateLimit   → 15 dk'da 2000 istek limit (DDoS)
[4] morgan      → log yaz
[5] authenticate → JWT geçerli mi? → user objesini req'e ekle
[6] caching     → Redis'te var mı? Varsa hemen dön (X-Cache: HIT)
[7] route       → kpiService.getSummary(filters)
[8] kpiService  → MySQL'e parametreli sorgu
[9] response    → JSON → Redis'e 1 saatlik cache
```

**Cache invalidation:** Yeni veri import edildiğinde veya tablo temizlendiğinde `kpi:*`, `data:*`, `import:*` prefixli tüm cache'ler silinir.

---

## 5. FRONTEND AKIŞI — Sayfa Açılışı

```
http://localhost:5173/campaigns
     ↓
main.jsx → App.jsx
     ↓
[1] AuthProvider     → localStorage'dan token oku, /me ile doğrula
[2] FilterProvider   → Anchor tarih çek, "son 30 gün" preset uygula
[3] BrowserRouter    → URL'i eşleştir
[4] ProtectedRoute   → user var mı? Yoksa → /login
[5] PermissionRoute  → view_campaigns iznin var mı? Yoksa → 403
[6] ErrorBoundary    → Sayfa çökerse kullanıcıya açıklama göster
[7] Layout           → Sidebar + Header
[8] CampaignsOverview → kpiAPI.campaignPerformance(filters)
     ↓
axios interceptor → Bearer token ekle → /api/kpi/...
     ↓
Cevap → ApexCharts + DataTable render
```

---

## 6. ROL VE İZİN SİSTEMİ

3 rol → her birinin varsayılan izin seti var. Adminin custom izin tanıma yetkisi var.

| Rol | Varsayılan İzinler |
|---|---|
| **admin** | Hepsi (kullanıcı yönetimi dahil) |
| **marketing** | view_overview, view_campaigns, view_products, view_platforms, view_decision_center, view_reports, export_excel, use_chatbot |
| **viewer** | Sadece view_* izinleri (import + user yok) |

**Çift katmanlı kontrol:**
- **Frontend (UX):** `PermissionRoute` izinsiz sayfaya kullanıcıyı sokmaz.
- **Backend (güvenlik):** `requirePermission` ve `requirePermissionForMutations` middleware'leri her endpoint'i korur. Frontend bypass edilse bile backend reddeder.

---

## 7. KPI HESAPLAMALARI (Ana Metrikler)

| Metrik | Formül |
|---|---|
| **Ciro** | `SUM(orders.revenue)` |
| **AOV** (Sepet Ort.) | `Ciro / Sipariş Sayısı` |
| **ROAS** | `Ciro / Reklam Harcaması` |
| **CPA** | `Reklam Harcaması / Dönüşüm` |
| **CTR** | `Tıklama / Gösterim × 100` |
| **CVR** | `Sipariş / Oturum × 100` |
| **Kâr** | `Ciro − Maliyet − Reklam Harcaması` |
| **Funnel** | View → Add to Cart → Purchase düşüş oranları |

---

## 8. SAYFA SAYFA NE GÖSTERİYOR

| Sayfa | Anahtar Mesaj | Görsel |
|---|---|---|
| **Overview** | "Genel sağlık panosu" | 4 KPI kartı + günlük ciro trendi + Meta/Google karşılaştırma |
| **Campaigns** | "Hangi kampanya kazandırıyor?" | Kampanya listesi, 2 kampanya karşılaştırma aracı, en çok satan ürün |
| **Products** | "En değerli ürünler" | Top satıcılar, kâr marjı, hedef vs gerçekleşen |
| **Platforms** | "Hangi kanal verimli?" | Meta/Google/Organic/Direct kırılımı |
| **Decision Center** | "Aksiyon önerileri" | Hedef durumu, Pareto (5 kampanya cironun %80'i), abandoned cart |
| **Reports** | "Excel olarak indir" | 4 farklı rapor türü (Genel/Kampanya/Platform/Ürün) |
| **Import** | "Veri yükle" | 4 adımlı sihirbaz: Dosya → Önizleme → Kolon Eşleme → Çalıştır |
| **Users** | "Kullanıcı yönetimi" | CRUD + rol/özel izin atama |
| **Chat (FAB)** | "Veriyi sor, cevabı al" | Gemini AI; "Mart ayında en kârlı 3 kampanya?" gibi sorular |

---

## 9. AI CHATBOT — Nasıl Çalışıyor?

```
Kullanıcı: "Mart 2025 en çok kazandıran 3 kampanya?"
     ↓
[1] /api/chat → Gemini'ye mesaj + 7 tool tanımı gönderilir
[2] Gemini: "getTopCampaigns({startDate:'20250301', endDate:'20250331', limit:3}) çağırmalıyım"
[3] Backend: KpiService.campaignPerformance(...) → MySQL'den çeker
[4] Sonuç Gemini'ye geri gönderilir
[5] Gemini doğal dilde özet üretir
[6] Frontend'e dönülür, sohbet balonunda görünür
```

**Tool listesi (7 adet):** getTopCampaigns, getTopProducts, getKpiSummary, compareplatforms, getProductDetail, getCampaignDetail, getAbandonedCart.

**Güvenlik:** Maksimum 5 iterasyon (sonsuz döngü yok), 15 saniye timeout (sergi sırasında takılmaz), `use_chatbot` izni gerekli, 2000 karakter mesaj limiti.

---

## 10. GÜVENLİK ÖNLEMLERİ

| Önlem | Nasıl |
|---|---|
| **SQL Injection** | Tüm sorgular parametreli (mysql2 prepared statements) |
| **XSS / Clickjacking** | Helmet middleware (CSP, X-Frame-Options) |
| **CORS** | Sadece izinli origin'den istek kabul |
| **Rate Limit** | 15 dk'da 2000 istek (`trust proxy` ile gerçek IP) |
| **Şifre** | bcrypt hash (10 round) — düz metin tutulmaz |
| **JWT** | 24 saat geçerli, secret .env'de |
| **Yetki** | İki katmanlı (frontend UX + backend zorlama) |
| **Dosya Upload** | 50 MB limit, uzantı kontrolü (CSV/XLSX/JSON) |
| **.env** | gitignore'da, repo'ya gitmiyor |
| **Hata Mesajları** | Production'da stack trace gizli |

---

## 11. SERGİ İÇİN İDEAL DEMO AKIŞI (10-12 dk)

> Önce **NODE_ENV**'i `production` yapma — geliştirme modunda kalsın ki hata olursa görebilesin. Sunucuyu sergi öncesi 1 saat çalıştırıp test et.

1. **Login** (30 sn)
   - "Email/şifre + JWT, 24 saat oturum"
   - `admin@sporthink.com` / `Admin2026!` zaten input'larda dolu

2. **Overview** (2 dk)
   - "Yöneticinin günlük sağlık taraması"
   - Filtre değiştir: 7 gün → 30 gün → custom → metrikler güncellensin
   - Söyle: "Redis cache var, ikinci çağrı milisaniye"

3. **Decision Center** (2 dk) ⭐ En değerli sayfa
   - "Sayı değil, **aksiyon** verir"
   - Pareto: "5 kampanya cironun %80'i"
   - Abandoned cart: "Şu kadar müşteri sepete attı, almadı → retarget"

4. **Campaigns + Compare** (2 dk)
   - 2 kampanya seç → side-by-side karşılaştır
   - Excel indir butonunu göster

5. **Products Drill-down** (1 dk)
   - Bir ürüne tıkla → o ürünün hangi kampanyadan kaç sattığını göster

6. **Import** (1.5 dk)
   - "Tablo durumu" kart grid'i: hangi tablo dolu, hangisi boş
   - Örnek CSV yükle → kolon eşleme adımını göster
   - "Tüm Verileri Temizle" butonu var ama gösterme (geri alınmaz)

7. **AI Chat** (1.5 dk) ⭐ En etkileyici
   - Sağ-alt FAB → "Mart ayında en çok kazandıran 3 kampanya?"
   - Gemini cevabı doğal dilde verecek
   - "Bu Gemini Function Calling: önce KPI endpoint'ini çağırıyor, sonra özetliyor"

8. **Users** (30 sn — opsiyonel)
   - "Rol + özel izin sistemi" göster, kapat

---

## 12. SIK SORULAN SORULARA HAZIR CEVAPLAR

**S: Neden React + Node?**
> Modern, hızlı geliştirme, geniş topluluk. React 19 yeni özellikler (use, server components) ile gelecek-uyumlu. Node ile JavaScript tam yığında tek dil.

**S: Neden MySQL, NoSQL değil?**
> Veri ilişkisel (orders ↔ order_items ↔ products). Raporlama için SQL'in JOIN/GROUP BY yetenekleri kritik. NoSQL agregasyonda yavaş kalırdı.

**S: Redis ne işe yarıyor?**
> KPI sorgularının çoğu ağır (milyon satırda GROUP BY). Aynı filtre tekrar gelirse 50 ms yerine 2 ms'de cevap. 1 saatlik TTL.

**S: AI nasıl güvenli kullanılıyor?**
> Gemini sadece **read-only** araçlar görür. Hiçbir DELETE/UPDATE fonksiyonu tanımlı değil. Veri kaybı imkânsız. 15s timeout var.

**S: Çoklu kullanıcı destekliyor mu?**
> Evet — 3 rol (admin/marketing/viewer) + JSON tabanlı özel izinler. Admin viewer'a istisnai olarak `import_data` izni verebilir.

**S: Veri nereden geliyor?**
> Pazarlama uzmanı CSV/XLSX olarak Meta Ads Manager, Google Ads, GA4, Shopify/WooCommerce export'larını panele yükler. Otomatik kolon eşleme yapar.

**S: Production'da nasıl çalışıyor?**
> Docker Compose ile MySQL + Redis + backend + frontend ayrı container'larda. Caddy önünde HTTPS reverse proxy. `.env.production` ile config.

---

## 13. SERGİ ÖNCESİ ÇALIŞTIRMA ADIMLARI

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev          # nodemon ile başlar

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# (Veritabanı ve Redis zaten Docker'da çalışıyor olmalı)
docker compose ps
```

**Test checklist (sergi öncesi 30 dk):**
- [ ] Backend açılıyor → `http://localhost:3000/api/health` → `database: connected, redis: connected`
- [ ] Frontend açılıyor → giriş yap
- [ ] Overview'de veri var (boş değil) — yoksa örnek veriyi yeniden yükle
- [ ] Filtreyi değiştir, metrikler değişiyor mu
- [ ] AI Chat → "test mesajı" yaz, cevap geliyor mu (15s'de yetişemezse timeout'a düşer)
- [ ] Reports → Excel indir, dosya açılıyor mu
- [ ] Import → sample CSV ile preview adımına kadar git
- [ ] Sidebar'daki tüm sayfaları aç-kapat, çökme var mı

---

## 14. ÖNE ÇIKARILACAK MÜHENDISLIK KARARLARı

Bunları sergi sırasında jüri/izleyici "ne özel?" diye sorarsa söyle:

1. **Çift katmanlı yetki:** Frontend kullanıcıyı engeller, backend gerçek koruma sağlar. Tarayıcı manipülasyonuyla bypass edilemez.
2. **Akıllı tarih filtresi (anchor-based):** "Son 30 gün" bugünden değil **verinin son tarihinden** geri sayar (`anchorDate = MAX(date)`). Demo/test verisinin geçmiş olması filtre boş döndürmez. Tarih, frontend'de YYYYMMDD string olarak üretilir → axios query string → backend route → MySQL `WHERE ... BETWEEN ?` prepared statement zinciri 100+ noktada uygulanır (`buildDateFilter` helper'ı + her tablonun kendi tarih kolonu: `ga4_traffic.date`, `orders.order_date`, `meta_ads.date_start`, `google_ads.date`, `customers.first_order_date`, `ga4_item_interactions.date`). Redis cache key tarihi içerdiği için stale veri imkansız.
3. **Cache + invalidation stratejisi:** Veri import edilince ilgili tüm cache key'leri prefix bazlı silinir. Stale veri görmek imkânsız.
4. **AI Function Calling:** Gemini halüsinasyon yapmasın diye veri sorularını mutlaka önce tool çağırarak çekmeye zorlanır (SYSTEM_INSTRUCTION ile).
5. **Trust proxy yapılandırması:** Caddy arkasında çalıştığı için rate-limit gerçek client IP'sini sayar, tüm kullanıcılar tek IP gibi davranmaz.
6. **Cancel token pattern'i:** Filtre hızlı değiştirilirse eski isteklerin yanıtı stale state'e yazılmaz (race condition önlemi).
7. **ErrorBoundary:** Tek bir sayfa çökse bile uygulamanın tamamı çalışmaya devam eder. Kullanıcıya teknik detay açıklamalı sayfa gösterilir.

---

## 15. ACİL DURUM SENARYOLARI

| Durum | Ne Yap |
|---|---|
| Backend yanıt vermiyor | `cd backend && npm run dev` ile yeniden başlat |
| Frontend beyaz ekran | Tarayıcı console'una bak; F5 ile yenile |
| MySQL bağlanmıyor | `docker compose up -d mysql` |
| Redis kapalı | Sorun değil — uygulama DB'den çalışır, sadece yavaşlar |
| AI chat cevap vermiyor | 15 saniyede timeout'a düşer, "tekrar dene" mesajı çıkar |
| Login olmuyor | `Admin2026!` şifresini denemeyi unutma; setup zaten yapılmış |
| Veri görünmüyor | Filtre "Tüm zamanlar" yap; tarih aralığı verinin dışında olabilir |

---

**Sergi'de başarılar! 🎯 Önemli olan kodu değil, **karar verme** sürecinde insana sağladığı **değeri** anlatmak.**
