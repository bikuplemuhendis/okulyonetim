# KampüsTakip

RFID’siz **Akıllı Kampüs Yönetim ve Verimlilik** web uygulaması. Kaynak spec: `akilli-kampus-takip` v1.0.2. Donanım / kart okuyucu / turnike cihazı **dahil değildir**; yoklama ve giriş-çıkış web akışlarıdır.

Ürün planı: [`docs/PLAN.md`](docs/PLAN.md)

Kampüs operasyonu (yoklama, kiosk, rehberlik) duruyor; üzerine **okul bilgi sistemi (SIS)** eklendi: dönem, takvim, not, sınav, ödev, materyal, karne, ücret/tahsilat, veli/öğrenci portalları.

## Çalıştırma

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Tarayıcı: [http://localhost:3000](http://localhost:3000)

Tüm demo hesapların parolası: **`Demo123!`**

| Rol | E-posta |
|---|---|
| Platform süper admin | `super@kampus.local` |
| Firma sahibi | `sahip@xkolej.local` |
| Firma operasyon | `operasyon@xkolej.local` |
| Şube müdürü (Çankaya) | `mudur@cankaya.local` |
| Sekreterlik | `sekreter@cankaya.local` |
| Öğretmen | `ogretmen@cankaya.local` |
| Rehberlik | `rehberlik@cankaya.local` |
| Veli (Mehmet Kaya) | `veli@cankaya.local` |
| Öğrenci (Mehmet Kaya) | `ogrenci@cankaya.local` |

SIS denemesi: öğretmen `ogretmen@cankaya.local` ile `/panel/sinavlar`, `/panel/notlar`, `/panel/odevler`, `/panel/materyaller`; veli `veli@cankaya.local` ile `/veli/notlar`, `/veli/odemeler`, `/veli/karne`; sekreterlik `sekreter@cankaya.local` ile `/panel/ucretler`.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS 4
- Prisma + SQLite (üretimde PostgreSQL önerilir)
- JWT çerezi, rol + şube kapsamı, tenant izolasyonu
- Materyal/ödev dosyaları `uploads/` altında (indirme: `/api/files/[id]`)
- Ücret: fatura + tahsilat kaydı (banka yok)

## RFID yerine ne var?

- Öğretmen **oturumu başlatır / finalize eder** (dijital sınıf defteri)
- Öğrenci **Derse katıl** veya lokasyon **kiosk**’unda öğrenci no
- Turnike = `GATE` lokasyonunda web check-in
- Canlı bina renkleri oturum + check-in olaylarından üretilir
- Cihaz eşleştirme ekranı yoktur

## Test / lint

```bash
npm test
npm run lint
```
