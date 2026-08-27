# KampüsTakip — Web Ürün Planı

Kaynak: *Akıllı Kampüs Yönetim ve Verimlilik Sistemi* teknik tasarım v1.0.2.  
**Kapsam dışı (donanım):** RFID okuyucu, kart, donanım kapısı, cihaz eşleştirme, IoT/MQTT, cihaz heartbeat.

Bu belge web ürününün mimarisini, rollerini, **kampüs operasyonu + okul bilgi sistemi (SIS)** modüllerini, veri modelini ve sayfalarını tanımlar.

## 1. Mimari

- **Uygulama:** Next.js 16 (App Router) + TypeScript, sunucu bileşenleri ve server actions.
- **Veri:** Prisma + SQLite (demo). Üretimde PostgreSQL’e geçiş Prisma datasource değişikliği ile yapılır (PDF 8.2).
- **Kimlik:** E-posta + parola, HTTP-only JWT çerezi (`jose`).
- **Yetki:** Rol + kapsam (firma / şube / kendi çocuk / kendi ders). Tüm kayıtlar `tenantId` ile izole edilir.
- **Dosya:** Materyal ve ödev ekleri yerel disk (`uploads/`); indirme RBAC ile `/api/files/[id]`.
- **Ödeme:** Banka/POS yok. Fatura + tahsilat kaydı ve bakiye.
- **Bildirim:** SMS/Push gerçek sağlayıcı yerine simüle edilen gönderim kaydı.
- **Çok kiracılılık:** Platform → Firma (Tenant) → Şube → Bina → Lokasyon → Sınıf / ders / program.

```
Tarayıcı (TR UI)
  └─ Next.js App Router
       ├─ RBAC + tenant / şube / çocuk / ders filtresi
       ├─ Kampüs kuralları (yoklama, oturum, istisna)
       ├─ SIS kuralları (not, sınav, ödev, ücret, karne)
       └─ Prisma / SQLite + yerel yüklemeler
```

## 2. RFID yerine web akışları

| PDF (RFID) | Web karşılığı |
|---|---|
| Kart okutma (sınıf kapısı) | Öğretmen sınıf defterinde işaretler **veya** öğrenci “Derse katıl” **veya** lokasyon kiosk’unda öğrenci no |
| Öğretmen kartıyla oturum açılması | Öğretmen “Oturumu başlat” |
| Turnike giriş/çıkış | Giriş/çıkış lokasyonunda kiosk veya operasyon check-in |
| Cihaz sağlığı / heartbeat | Lokasyonun son web olayı (son check-in zamanı) |
| Ham RFID olayı | `CheckInEvent` (kaynak: TEACHER / STUDENT_WEB / KIOSK / GATE / ADMIN) |
| Anti-passback | Aynı oturumda ilk check-in geçerli, tekrarı `IGNORED` |

## 3. Roller

| Rol | Kod | Kapsam |
|---|---|---|
| Platform Süper Admin | `PLATFORM_SUPER_ADMIN` | Tüm tenant’lar |
| Firma Sahibi | `TENANT_OWNER` | Firma + şubeler |
| Firma Operasyon | `TENANT_OPS` | Firma tanımları; kritik düzeltme kısıtlı |
| Şube Müdürü | `BRANCH_MANAGER` | Kendi şubesi |
| Şube Operasyon / Sekreterlik | `BRANCH_OPS` | Günlük listeler, tahsilat, veli bilgilendirme |
| Öğretmen | `TEACHER` | Kendi dersleri / sınıfları (not, ödev, materyal, yoklama) |
| Rehberlik | `COUNSELOR` | 360° profil, görüşme (gizlilik) |
| Veli | `PARENT` | Bağlı çocuklar |
| Öğrenci | `STUDENT` | Kendi özeti |

**Kritik kurallar**

- Yoklama düzeltme: yalnızca `TENANT_OWNER` veya `BRANCH_MANAGER`; tenant’taki düzeltme penceresi (saat).
- Öğretmen yalnızca programındaki sınıf+ders için not / sınav / ödev girer.
- Öğretmen özel notunu başka öğretmen göremez (sahip / müdür / yazar görebilir).
- Veli yalnızca bağlı çocukların not, ödev, duyuru, ödeme ve materyallerini görür.
- Öğrenci yalnızca kendi kayıtlarını görür; yayımlanmamış sınav/karne gizlidir.
- Rehberlik notu `HIGH`: yalnızca rehberlik (+ isteğe bağlı sahip).
- Export: KVKK maskeleme politikası (telefon / e-posta).
- Program kaydında lokasyon **ve** öğretmen **ve** sınıf saat çakışması reddedilir.

## 4. Modüller ve sayfalar

### 4.1 Kampüs (mevcut, korunur)

| Modül | Rotalar |
|---|---|
| Kimlik | `/login` |
| Kokpit (BI) | `/panel` |
| Firmalar (süper admin) | `/panel/firmalar` |
| Firma ayarları | `/panel/ayarlar` |
| Okul yapısı | `/panel/yapi` |
| Şubeler | `/panel/subeler`, `/panel/subeler/[id]` |
| Binalar / lokasyonlar | `/panel/binalar`, `/panel/lokasyonlar` |
| Kullanıcılar | `/panel/kullanicilar` |
| Sınıflar / dersler | `/panel/siniflar`, `/panel/dersler` |
| Öğrenciler | `/panel/ogrenciler`, `/panel/ogrenciler/[id]` |
| CSV import | `/panel/import` |
| Canlı bina | `/panel/canli` |
| İstisnalar | `/panel/istisnalar` |
| Dijital sınıf defteri | `/panel/yoklama`, `/panel/yoklama/[sessionId]` |
| Rehberlik | `/panel/rehberlik`, `/panel/rehberlik/[studentId]` |
| Duyurular | `/panel/duyurular` |
| Bildirim şablonları / gönderim | `/panel/sablonlar`, `/panel/bildirimler` |
| Raporlar | `/panel/raporlar` |
| Denetim izi | `/panel/denetim` |
| Mazeretler | `/panel/mazeretler` |
| Kiosk | `/kiosk/[locationId]` |

### 4.2 SIS (bu sürümde eklenen)

| Modül | Rotalar | Kim |
|---|---|---|
| Akademik dönem | `/panel/donemler` | sahip, ops, müdür |
| Okul takvimi | `/panel/takvim` | personel; veli/öğrenci salt okunur portallarda |
| Haftalık ders programı | `/panel/program` | ızgara + CRUD; öğretmen: kendi programı |
| Öğretmen sınıflarım | `/panel/siniflarim` | öğretmen |
| Sınav tanımı / puan | `/panel/sinavlar`, `/panel/sinavlar/[id]` | öğretmen (kendi dersi), akademik yönetim |
| Not defteri | `/panel/notlar` | öğretmen / yönetim |
| Ödev | `/panel/odevler`, `/panel/odevler/[id]` | öğretmen CRUD; öğrenci teslim |
| Materyal | `/panel/materyaller` | öğretmen yükler; paylaşım sınıf/ders/şube |
| Karne / transkript | `/panel/karne`, `/panel/karne/[id]` | üretim + yayın |
| Öğretmen özel notu | `/panel/ogretmen-notlari` | yalnızca yazar (+ sahip/müdür) |
| Ücret türleri / borç / tahsilat | `/panel/ucretler`, `/panel/ucretler/[id]` | sekreterlik, müdür, sahip |
| Veli portalı | `/veli`, `/veli/devamsizlik`, `/veli/notlar`, `/veli/odevler`, `/veli/materyaller`, `/veli/duyurular`, `/veli/odemeler`, `/veli/karne`, `/veli/takvim`, `/veli/bildirimler` | veli |
| Öğrenci portalı | `/ogrenci`, `/ogrenci/program`, `/ogrenci/notlar`, `/ogrenci/odevler`, `/ogrenci/odevler/[id]`, `/ogrenci/materyaller`, `/ogrenci/duyurular`, `/ogrenci/odemeler`, `/ogrenci/karne` | öğrenci |

## 5. Veri modeli

**Kampüs:** Tenant, Branch, Building, Location, User, UserBranchScope, Classroom, Course, Student, ParentStudent, LessonSchedule, LessonSession, Attendance, CheckInEvent, Incident, CounselingRecord, ExcuseRequest, Announcement, NotificationTemplate, NotificationRecord, NotificationPreference, AuditLog.

**SIS:**

- `AcademicTerm` — dönem (güz/bahar), `isCurrent`, tarih aralığı
- `CalendarEvent` — tatil, sınav günü, toplantı, dönem olayı
- `Exam` + `ExamScore` — sınav tanımı, 0–maxScore, ağırlık, yayın bayrağı
- `Assignment` + `AssignmentSubmission` — ödev, teslim, puan, dosya
- `Material` — eğitim içeriği (dosya + görünürlük: PRIVATE / CLASS / COURSE / BRANCH)
- `FeeType` + `Invoice` + `Payment` — ücret tanımı, borç, tahsilat, bakiye
- `TeacherNote` — öğretmene özel öğrenci notu
- `ReportCard` + `ReportCardLine` — dönem karnesi (ağırlıklı ortalama + harf + 5’lik)

`LessonSchedule.termId` isteğe bağlı: dönemlik program veya yıl boyu satır.

Ayrıntı: `prisma/schema.prisma`.

## 6. Not ve ücret kuralları

1. Puan `0 … maxScore`. 100’lük dilim: `(puan / maxScore) * 100`.
2. Dönem ders ortalaması: yayımlanmış sınav + notlandırılmış ödev; ağırlıklı ortalama.
3. Harf: AA≥90, BA≥85, BB≥80, CB≥75, CC≥70, DC≥60, DD≥50, FF&lt;50.
4. 5’lik: 5≥85, 4≥70, 3≥60, 2≥50, 1&lt;50.
5. Karne satırları bu ortalamadan üretilir; veli/öğrenci yalnızca `published` karneyi görür.
6. Fatura bakiyesi = tutar − tahsilatlar. 0 → PAID, ara → PARTIAL, tahsilatsız → OPEN. Fazla ödeme reddedilir. İptal bakiyeyi 0 saymaz, tahsilatı kilitler.
7. Materyal indirme: öğretmen sahibi, yönetim, paylaşım kapsamındaki öğrenci ve o öğrencinin velisi.

## 7. KVKK

- Veri minimizasyonu: operasyon için gerekli alanlar.
- Maskeleme: tenant politikası + rol.
- Rehberlik ve öğretmen özel notları ayrı gizlilik.
- Audit: sınav/not/tahsilat/karne yayınında old/new, aktör, sonuç.

## 8. Kabul

- Ders yoklaması program + öğretmen oturumu ile tutarlı (kampüs).
- Haftalık program ızgarası kullanılabilir; çakışma (lokasyon, öğretmen, sınıf) kayıtta reddedilir.
- Öğretmen kendi sınıfında not/ödev/materyal/yoklama yapar; başkasının özel notunu görmez.
- Veli yalnızca çocuklarını görür: yoklama, not, ödev, duyuru, ödeme, materyal, karne.
- Sınav puanı aralık dışı kaydedilemez; karne ağırlıklı ortalamayı yansıtır.
- Fatura bakiyesi tahsilatlarla tutarlıdır; veli ödeme durumunu görür.
- Demo hesaplar (`Demo123!`) tüm yeni modüllerde dolu veri ile açılır.

## 9. Bilinçli dışarıda bırakılanlar (tam okul OS’ye göre)

Bu tur web SIS’i çalışır hale getirir; üretim okul OS’nin tamamı değildir:

- e-Okul / MEB senkron, e-imza, resmi diploma şablonu
- Gerçek banka/POS, otomatik mahsup, muhasebe entegrasyonu
- İK / bordro, servis GPS, yemekhane POS, kütüphane katalogu
- Online kayıt/kabul, video ders, oturum planı, SMS sağlayıcı
