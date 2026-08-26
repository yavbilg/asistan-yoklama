# Asistan Yoklama

Sakarya Psikiyatri Ana Bilim Dalı asistan devam takip sistemi.
Next.js 16 + PostgreSQL.

## Ne yapar

- **Yoklama oturumu** açılır; asistanlar QR kod okutarak katılır ya da liste
  üzerinden elle işaretlenir.
- **Muafiyetler otomatik işlenir**: aylık dış rotasyon, günlük görev çizelgesi,
  kıdem ve sabit görevlendirmeler birleştirilir.
- **Excel çıktısı**: tek oturum veya tarih aralıklı dönem raporu.

## Kurulum

```bash
npm install
cp .env.example .env.local     # DATABASE_URL ve TOKEN_SECRET doldurulur
npm run db:setup               # şemayı kurar, ilk asistan listesini yükler
npm run dev
```

`npm run db:setup` tekrar tekrar çalıştırılabilir; mevcut veriye dokunmaz.

## Aylık kullanım

`/cizelge` ekranından her ay iki dosya yüklenir. İkisi de önce **önizlenir**,
onaylanmadan hiçbir şey kaydedilmez.

| Dosya | İçerik | Etkisi |
|---|---|---|
| Rotasyon listesi | Kimin o ay hangi birimde olduğu | Nöroloji, Çoc. Psikiyatrisi, TRSM ve İzin/Rapor'daki asistanlar **tüm ay** muaf |
| Günlük çalışma listesi | Gün gün nöbet ertesi, izin, poliklinik, konsültasyon | O günkü derste ilgili kişiler muaf |

Çizelgelerde geçen ama tanınmayan isimler sessizce atlanmaz; ekranda listelenir
ve bir kez eşlenince (`name_aliases`) sonraki yüklemelerde otomatik uygulanır.

**Muafiyet önceliği:** günlük görev → aylık rotasyon → sabit görevlendirme → kıdem.
Daha somut olan kazanır; hepsi muaf sonucu verir, yalnızca gösterilen sebep değişir.

## Ekranlar

| Yol | İş |
|---|---|
| `/` | Oturum aç/kapat, geçmiş oturumlar, dönem raporu |
| `/yoklama/[id]` | Yoklama listesi — işaretleme, arama, toplu işlem |
| `/qr/[id]` | Projeksiyona yansıtılan QR kod (40 sn'de bir yenilenir) |
| `/katilim` | Asistanın telefonunda açılan katılım ekranı |
| `/asistanlar` | Asistan listesi yönetimi |
| `/cizelge` | Aylık rotasyon ve günlük çizelge yükleme |

## Veritabanı

Şema `src/lib/schema.sql` içinde. Tablolar:

- `assistants` — asistan listesi (silinmez, pasife alınır)
- `sessions` — yoklama oturumları; `UNIQUE (lesson_name, date, start_time)`
- `attendance` — kişi başına tek satır, `PRIMARY KEY (session_id, assistant_id)`
- `duty_assignments` — günlük görevler
- `rotations` — aylık dış rotasyonlar (tarih aralığı)
- `name_aliases` — çizelgedeki yazımların asistanlara eşlenmesi
- `used_tokens` — QR kodların tek kullanımlık olmasını sağlar

## Güvenlik notları

- QR token'ı sunucuda üretilip doğrulanır; imzalama anahtarı (`TOKEN_SECRET`)
  tarayıcıya inmez. Her token tek kullanımlıktır ve 40 saniyede geçersizleşir.
- **Yönetim ekranlarında kimlik doğrulama yoktur.** `/`, `/asistanlar` ve
  `/cizelge` adresi bilen herkese açıktır; `/yoklama` sayfasındaki parola
  istemci tarafındadır ve gerçek koruma sağlamaz. Yayına almadan önce
  çözülmesi gereken konu budur.
