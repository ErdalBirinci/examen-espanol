# Examen de Español

İspanyolca seviye sınavı: aday kaydı, dört bölümlü sınav (test · dinleme · yazma · konuşma) ve
içerik/yönetim paneli. Arayüz GitHub Pages üzerinde statik olarak çalışır; veriler Supabase'de tutulur.

- **Aday arayüzü:** açık, Apple tarzı premium tasarım · İspanyolca
- **Yönetim paneli:** `/adminpanel` · Türkçe · gerçek oturum doğrulaması
- **Sınav akışı:** 50 soruluk çoktan seçmeli test → dinleme + transkripsiyon → yazma kompozisyonu → ses kaydı

## Mimari

| Katman | Teknoloji |
| --- | --- |
| Ön yüz | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Hosting | GitHub Pages (`dist/`, SPA fallback `404.html`) |
| Veritabanı | Supabase Postgres (RLS korumalı) |
| Ses dosyaları | Supabase Storage (`exam-media`, `exam-recordings`) |
| Yönetici girişi | Supabase Auth (kullanıcı adı → `kullanıcı@examen.local`) |

Doğru cevap anahtarları adaylara hiçbir zaman gönderilmez: adaylar `questions_public` görünümünü okur,
puanlama `attempts` tablosundaki `score_attempt` trigger'ı ile sunucuda hesaplanır.

## 1. Supabase kurulumu

1. [supabase.com](https://supabase.com) üzerinde ücretsiz bir proje oluştur.
2. **SQL Editor** → [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını çalıştır. Ardından
   `supabase/migrations/` altındaki dosyaları sırayla uygula (süre ayarları, sunucu taraflı gönderim,
   sonuç sorgulama ve dinleme transkripti). Hepsi idempotent: tekrar çalıştırmak güvenli.
3. **Authentication → Users → Add user** ile yönetici hesabını oluştur:
   - E-posta: `<kullanıcı_adı>@examen.local` (örn. `yonetici@examen.local`)
   - Şifre: kendi belirlediğin güçlü şifre
   - *Auto Confirm User* seçili olsun
   - Şifreyi bu depoya veya README'ye yazma.
4. Aynı dosyanın sonundaki `insert into public.profiles ...` bloğunun yorumunu kaldırıp çalıştır.
   (Bu, hesabı yönetici rolüne bağlar.)
5. İsteğe bağlı: [`supabase/seed.sql`](supabase/seed.sql) ile her seviye için 10 örnek soru ve birer
   yazma/konuşma konusu eklenir. Dinleme seslerini panelden yüklemen gerekir.
6. **Project Settings → API** altından `Project URL` ve `anon public` anahtarını al.

## 2. Yerel geliştirme

```bash
npm install
cp .env.example .env      # URL ve anon key'i gir
npm run dev
```

`.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Anon key herkese açık olacak şekilde tasarlanmıştır; tüm erişim RLS politikalarıyla sınırlanır.
`service_role` anahtarını asla ön yüze koyma.

## 3. GitHub Pages yayını

1. Depoyu GitHub'a pushla (varsayılan dal `main`).
2. **Settings → Secrets and variables → Actions → Variables** altında ekle:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Settings → Pages → Build and deployment → Source: GitHub Actions** seç.
4. `.github/workflows/deploy.yml` her `main` push'unda derleyip yayınlar.

Yayın adresi: `https://<kullanıcı>.github.io/<repo>/`
Yönetim paneli: `https://<kullanıcı>.github.io/<repo>/adminpanel`

Deep link'ler için `postbuild` adımı `dist/index.html` dosyasını `dist/404.html` olarak kopyalar;
böylece `/adminpanel` gibi adresler doğrudan açılır.

## 4. Yönetim paneli

`/adminpanel` adresinden kullanıcı adı ve şifre ile giriş yapılır. Kullanıcı adı otomatik olarak
`<kullanıcı_adı>@examen.local` e-postasına eşlenir.

| Bölüm | Ne yapar |
| --- | --- |
| Genel Bakış | Toplam sınav, aylık hacim, bekleyen değerlendirme, ortalama test başarısı, içerik tamlık matrisi, seviye süreleri ve JSON yedek |
| Sınav Sonuçları | Aday cevapları, dinleme transkriptleri, yazma metni, ses kaydı oynatma; dinleme/yazma/konuşma puanlama (0–100), ağırlıklı toplam ve not |
| Test Soruları | Seviye bazında çoktan seçmeli soru CRUD (4 seçenek, doğru cevap, sıra) |
| Dinleme | Ses dosyası yükleme (maks. 50 MB), başlık, dinleme hakkı, sıra, değerlendirme transkripti |
| Yazma | Seviye başına konu metni ve minimum kelime |
| Konuşma | Seviye başına konu, yönlendirme, süreler |

Adayların yönetim paneline erişimi yoktur; admin rotaları oturum + `profiles.role = 'admin'`
kontrolünden geçer, tüm veri erişimi RLS ile korunur.

### Toplu soru içe aktarma

**Test Soruları → Toplu içe aktar** ile seçili seviyeye CSV veya JSON dosyası yüklenebilir ya da içerik
doğrudan yapıştırılabilir. Aktarım öncesi önizleme; geçerli, hatalı ve zaten var olan soruları gösterir;
yalnızca geçerli satırlar eklenir (yinelenen soru metinleri atlanır).

**CSV indir** butonu seçili seviyedeki tüm soruları, içe aktarmayla aynı sütun düzeninde indirir
(UTF-8 BOM'lu, Excel ile uyumlu). İndirilen dosya düzenlenip aynı seviyeye yeniden aktarılabilir;
soru metinleri zaten kayıtlı olduğu için yinelenen satırlar atlanır.

CSV başlıkları (Türkçe başlıklar da tanınır: `soru, secenek_a…, dogru, aciklama, sira`):

```csv
prompt,option_a,option_b,option_c,option_d,correct,explanation,position
"¿Cómo ___?",te llamas,te llama,se llamas,llamas,A,,1
```

JSON biçimi (dizi ya da `{ "questions": [...] }`):

```json
[
  {
    "prompt": "¿Cómo ___?",
    "options": ["te llamas", "te llama", "se llamas", "llamas"],
    "correct": "A",
    "explanation": "Saludo básico",
    "position": 1
  }
]
```

- `correct` alanı A–F harfi veya 1–6 numarası kabul eder; JSON'da `correct_index` kullanılırsa 0 tabanlıdır.
- `position` verilmezse mevcut soruların ardına sırayla eklenir.
- En az iki seçenek gerekir; boş seçenek içeren satırlar reddedilir.

## 5. Sınav akışı

1. Aday ad, soyad ve e-posta girer, seviyesini seçer (A1–C2).
2. **Vocabulario y Gramática:** 50 çoktan seçmeli soru (seviyede kaç soru varsa o kadar gösterilir).
3. **Comprensión Auditiva:** her ses kaydı en fazla `max_plays` kez dinlenebilir; aday duyduğunu yazar.
4. **Expresión Escrita:** konu hakkında kompozisyon; kelime sayacı ve minimum kelime uyarısı.
5. **Expresión oral:** mikrofonla kayıt veya dosya yükleme (maks. 50 MB); önizleme ve değiştirme.
6. **Süre:** seviye başına toplam süre (`exam_settings`, varsayılan 45–90 dk) panelden ayarlanır. Süre
   üstteki sayaçta görünür; son 5 dakikada sarı, son 1 dakikada kırmızı olur. Süre bitince sınav
   bulunulan bölümden otomatik gönderilir.
7. **Özet ekranı:** gönderimden önce dört bölümün durumu ve eksikler listelenir; aday onaylayarak gönderir.
8. Gönderim `submit_attempt` RPC'siyle yapılır: sunucu isim/e-posta/biçim doğrular, aynı e-posta ile
   2 dakika içinde ikinci gönderimi engeller ve test puanını hesaplar. Adaya bir referans kodu gösterilir.
9. **Sunucu taslağı:** sınav başlarken `exam_drafts` kaydı oluşur, cevaplar ~1 saniye gecikmeyle
    kaydedilir. Aynı tarayıcıda token ile otomatik, başka cihazda **taslak kodu + e-posta** ile giriş
    sayfasındaki "¿Empezaste en otro dispositivo?" bağlantısından devam edilir. Süre sunucudaki
    `started_at` üzerinden işler. Gönderimde taslak silinir, 7 günden eski taslaklar temizlenir.
10. **Sonuç sorgulama:** `/resultado` sayfasında referans kodu + e-posta ile yalnızca kendi puan özeti
    görüntülenir. Değerlendirme bitmeden bölüm puanları ve genel toplam "—" görünür.

## 6. Notlar ve sınırlar

- Dinleme sesleri herkese açık okunur (aday dinleyebilsin diye); konuşma kayıtları **özel** kovadadır,
  panelde imzalı (geçici) bağlantı ile açılır. Dinleme hakkı (`max_plays`) istemcide sayılır; dosya
  doğrudan indirilerek sınırsız dinlenebilir.
- `attempts` tablosuna anonim yazma kapalıdır. Aday kaydı yalnızca `submit_attempt` RPC'si üzerinden,
  doğrulama ve hız sınırıyla oluşur; okuma/güncelleme/silme yalnızca yöneticidedir.
- 50 MB sınırı hem istemcide hem Supabase Storage kova ayarında uygulanır.
- Yedek: **Genel Bakış → Yedek indir** tüm tabloları JSON olarak indirir (soru, dinleme, yazma,
  konuşma, sınavlar, süre ayarları). Geri yükleme henüz otomatik değildir.
- Sonuç listesi sunucu tarafında sayfalanır (25 kayıt) ve isim/e-posta araması veritabanında yapılır.
- **Sonuç e-postası:** `supabase/functions/notify-result` edge function'ı, puanlama kaydedildiğinde
  adaya Resend üzerinden sonuç özetini yollar. Gerekli secret'lar: `RESEND_API_KEY`,
  `RESULT_FROM_EMAIL` (doğrulanmış gönderici), `APP_PUBLIC_URL`. Secret'lar eklenmeden puanlama
  çalışır; panel "E-posta servisi yapılandırılmadı" uyarısı gösterir ve gönderim atlanır.
  Aynı sonuç ikinci kez e-postalanmaz (`attempts.result_notified_at`).
- Ücretsiz Supabase planı 1 GB dosya depolama ve 500 MB veritabanı içerir; yoğun kullanımda planı
  yükseltmek gerekebilir.

## Proje yapısı

```
src/
  exam/        Aday akışı (giriş, seviye, test, dinleme, yazma, konuşma)
  admin/       Yönetim paneli (giriş, sonuçlar, içerik yönetimi)
  components/  Ortak arayüz bileşenleri
  lib/         Supabase istemcisi, API katmanı, tipler
supabase/
  schema.sql   Tablolar, RLS, storage kovaları, puanlama
  seed.sql     Örnek içerik
  migrations/  Sonradan eklenen şema ve RPC'ler (sırayla uygula)
```
