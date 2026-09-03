# NidoKit incelemesi (2026-09-03)

Kaynak: [nidokit.com](https://nidokit.com/), Play Store `com.nidokitmobile` (PARE Teknoloji, Kadıköy).

## Ne?

K-12 SIS değil. **Anaokulu / kreş / gündüz bakımevi** operasyon paneli.

Vaad: WhatsApp karmaşasını azalt, yoklamayı hızlandır, veliyi tek akıştan bilgilendir.

Çekirdek: sınıf yoklaması, **günlük rapor**, veli mesajı, şube/yaş grubu görünürlüğü, mobil veli uygulaması, foto paylaşımı.

Paketler: 1–sınırsız şube, öğrenci kotası, depolama (foto), 14 gün deneme. Veli ücretsiz.

## KampüsTakip boşluğu (önce)

Biz K-12 + kampüs + finans’ta öndeyiz. NidoKit’in satış dilinde kazandığı şeyler bizde yoktu:

- Günlük bakım karnesi (ruh hali, öğün, uyku, tuvalet, etkinlik, foto notu)
- Teslim/yetkili kişi
- Yaş grubu dilı (çocuk, eğitmen, yuva)
- Mobil-first veli “bugün nasıl geçti?” akışı

## Karar: 3 lokalizasyon, 1 çekirdek

| Dikey | Marka | Satış alanı | Gizlenen ağırlık |
|---|---|---|---|
| KAMPUS | KampüsTakip | Koleji, lise, ortaokul | — |
| NIDO | NidoTakip | Anaokulu, kreş | Not, ödev, etüt, kütüphane, öğrenci portalı |
| KURS | KursTakip | Dershane, etüt merkezi | Canlı bina, servis, yemek, nöbet |

Firma ayarından dikey değişir; süper admin tenant açarken seçer.

Demo: `sahip@nido.local`, `veli@nido.local`, `sahip@kurs.local` (parola `Demo123!`).
