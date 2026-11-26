<p align="center"><img src="brand/wordmark.png" width="420" alt="Code-Tr"></p>

<p align="center"><b>Ücretsiz, Türkçe yapay zekâ asistanı</b> — sohbet et, kod yazdır, PDF özetlet, görsel üret.</p>
<p align="center"><a href="https://coder-tr.vercel.app"><b>coder-tr.vercel.app</b></a> · <a href="https://coder-tr.vercel.app/hakkinda.html">Hakkında</a> · <a href="LICENSE">MIT</a></p>

---

## Neden?

Güçlü yapay zekâ araçlarının çoğu ücretli, İngilizce ya da kredi kartı istiyor. Code-Tr, dünyadaki ücretsiz modelleri tek bir sade, Türkçe arayüzde toplar: öğrenciler, küçük işletmeler ve yazılıma yeni başlayanlar için.

## Özellikler

- **Sohbet** — akarak gelen cevaplar, Markdown ve renkli kod blokları
- **Kod** — kod yazar; klasör seçersen dosyaları okur, düzenler (yazma ve komutlar onay ister)
- **Görsel** — yazdığını ücretsiz görsele çevirir (kare, dikey, yatay, gönderi)
- **Ekler** — görsel, PDF (taranmış PDF dahil) ve metin dosyaları
- **Hesaplar** — e-posta/şifre ya da Google ile giriş; sohbetler her cihazda
- **Hızlı ve dayanıklı** — bir model meşgulse anında başka ücretsiz modele geçer
- **Mac uygulaması** — Ollama ile internetsiz, yerel modellerle de çalışır
- **Gizlilik** — KVKK aydınlatma metni, tek tıkla hesap ve veri silme

## Yapı

```
web/
  index.html        Arayüz (tek dosya; web ve Mac sürümü ortak)
  server.py         Mac uygulamasının yerel sunucusu (yalnızca Python standart kütüphanesi)
  api/              Vercel sunucu fonksiyonları
    chat.js         OpenRouter vekili: yalnızca ücretsiz modeller, yedek modellere yarış
    models.js       Ücretsiz model listesi
    auth.js         Kayıt / giriş / hesap (PBKDF2 şifreleme, HttpOnly oturum çerezi)
    chats.js        Sohbet eşitleme
    google.js       Google ile giriş (OAuth 2.0)
    contact.js      İletişim formu
  legal/            Hakkında, Gizlilik/KVKK, Kullanım Şartları
  version.json      Sürüm ve "Yenilikler" notları
mac/                Mac uygulaması başlatıcısı ve simge
build.sh            Mac uygulamasını ve web sitesini üretir
```

## Kendi sunucunda çalıştır

1. Bu depoyu klonla ve `./build.sh` çalıştır; `site/` klasörü oluşur.
2. `site/` klasörünü Vercel'e yükle (`vercel deploy --prod`).
3. Vercel ortam değişkenleri:
   - `OPENROUTER_API_KEY` — [openrouter.ai/keys](https://openrouter.ai/keys) (ücretsiz)
   - Upstash Redis entegrasyonu (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) — hesaplar için
   - İsteğe bağlı: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google ile giriş

## Mac uygulaması

`./build.sh install` → `/Applications/Code-Tr.app`. Yerel modeller için [Ollama](https://ollama.com) kurulu olmalı. Uygulama imzasız olduğundan ilk açılışta sağ tık → **Aç**.

## Yazı tipi

[Manrope](https://fonts.google.com/specimen/Manrope), SIL Open Font License 1.1.

## Lisans

[MIT](LICENSE) © 2026 Code-Tr
