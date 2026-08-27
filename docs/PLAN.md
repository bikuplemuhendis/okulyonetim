# KampüsTakip — Web Ürün Planı

Kaynak: *Akıllı Kampüs Yönetim ve Verimlilik Sistemi* teknik tasarım v1.0.2.  
**Kapsam dışı:** RFID okuyucu, kart, donanım kapısı, cihaz eşleştirme, IoT/MQTT, cihaz heartbeat.

Bu belge web ürününün mimarisini, rollerini, modüllerini, veri modelini, sayfalarını ve RFID yerine geçen web akışlarını tanımlar.

## 1. Mimari

- **Uygulama:** Next.js 16 (App Router) + TypeScript, sunucu bileşenleri ve server actions.
- **Veri:** Prisma + SQLite (demo). Üretimde PostgreSQL’e geçiş Prisma datasource değişikliği ile yapılır (PDF 8.2).
- **Kimlik:** E-posta + parola, HTTP-only JWT çerezi (`jose`). OTP/MFA ve kurumsal SSO V1’de opsiyonel bırakıldı; arayüzde telefon alanı ve MFA notu vardır.
- **Yetki:** Rol + kapsam (firma / şube). Tüm kayıtlar `tenantId` ile izole edilir.
- **Bildirim:** SMS/Push gerçek sağlayıcı yerine **simüle edilen gönderim kaydı** (şablon, kanal, sessiz saat, rate-limit).
- **Çok kiracılılık:** Platform → Firma (Tenant) → Şube → Lokasyon (web yoklama/giriş noktası).

```
Tarayıcı (TR UI)
  └─ Next.js App Router
       ├─ RBAC + tenant filtresi
       ├─ İş kuralları (yoklama, oturum, istisna, bildirim)
       └─ Prisma / SQLite
```

## 2. RFID yerine web akışları

| PDF (RFID) | Web karşılığı |
|---|---|
| Kart okutma (sınıf kapısı) | Öğretmen sınıf defterinde işaretler **veya** öğrenci “Derse katıl” **veya** lokasyon kiosk’unda öğrenci no |
| Öğretmen kartıyla oturum açılması | Öğretmen “Oturumu başlat” |
| Turnike giriş/çıkış | Giriş/çıkış lokasyonunda kiosk veya operasyon check-in |
| Cihaz sağlığı / heartbeat | Lokasyonun son web olayı (son check-in zamanı) |
| Cihaz eşleştirme | **Yok** — lokasyon bir web check-in noktasıdır |
| Ham RFID olayı | `CheckInEvent` (kaynak: TEACHER / STUDENT_WEB / KIOSK / GATE / ADMIN) |
| Anti-passback (mükerrer kart) | Aynı oturumda ilk check-in geçerli, tekrarı `IGNORED` |
| Oturum beklemede buffer | Öğretmen oturumu yokken gelen check-in `PENDING`; oturum açılınca katıldı/geç’e çevrilir |

## 3. Roller (PDF 3.1)

| Rol | Kod | Kapsam |
|---|---|---|
| Platform Süper Admin | `PLATFORM_SUPER_ADMIN` | Tüm tenant’lar |
| Firma Sahibi | `TENANT_OWNER` | Firma + şubeler |
| Firma Operasyon | `TENANT_OPS` | Firma tanımları; kritik düzeltme kısıtlı |
| Şube Müdürü | `BRANCH_MANAGER` | Kendi şubesi |
| Şube Operasyon / Sekreterlik | `BRANCH_OPS` | Günlük listeler, veli bilgilendirme |
| Öğretmen | `TEACHER` | Kendi ders oturumları / sınıfları |
| Rehberlik | `COUNSELOR` | 360° profil, görüşme (gizlilik) |
| Veli | `PARENT` | Bağlı çocuklar |
| Öğrenci | `STUDENT` | Kendi özeti |

**Kritik kurallar**

- Yoklama düzeltme: yalnızca `TENANT_OWNER` veya `BRANCH_MANAGER`; tenant’taki düzeltme penceresi (saat).
- Toplu bildirim: müdür / sahip / şube operasyon; şablon zorunlu; alıcı sayısı loglanır.
- Rehberlik notu `HIGH`: yalnızca rehberlik (+ isteğe bağlı sahip).
- Export: KVKK maskeleme politikası (telefon / e-posta).

## 4. Modüller ve sayfalar

| Modül | Rotalar |
|---|---|
| Kimlik | `/login` |
| Kokpit (BI) | `/panel` |
| Firmalar (süper admin) | `/panel/firmalar` |
| Firma ayarları | `/panel/ayarlar` |
| Şubeler | `/panel/subeler`, `/panel/subeler/[id]` |
| Lokasyonlar | `/panel/lokasyonlar` |
| Kullanıcılar | `/panel/kullanicilar` |
| Sınıflar / dersler / program | `/panel/siniflar`, `/panel/dersler`, `/panel/program` |
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
| Veli | `/veli`, `/veli/devamsizlik`, `/veli/bildirimler` |
| Öğrenci | `/ogrenci` |
| Kiosk | `/kiosk/[locationId]` |

## 5. Veri modeli (özet)

Tenant, Branch, Location, User, UserBranchScope, Classroom, Course, Student, ParentStudent, LessonSchedule, LessonSession, Attendance, CheckInEvent, Incident, CounselingRecord, ExcuseRequest, Announcement, NotificationTemplate, NotificationRecord, NotificationPreference, AuditLog.

Ayrıntı: `prisma/schema.prisma`.

## 6. İş kuralları (PDF 7)

1. Ders yoklaması sayılması için: o lokasyonda o saatte program **ve** öğretmen oturumu açık olmalı.
2. Aynı oturumda mükerrer check-in yok sayılır.
3. Geç kalma: ders başlangıcı + eşik (dk).
4. Devamsızlık: finalize’da işaretsiz öğrenciler `ABSENT`; veli zaman tüneli ve istisna listesi.
5. Bildirim tekrarı: aynı olay türü için kısa süre içinde yeniden gönderilmez.
6. Sessiz saatlerde (veli tercihi) acil olmayan bildirimler `SUPPRESSED`.

## 7. KVKK

- Veri minimizasyonu: operasyon için gerekli alanlar.
- Maskeleme: tenant politikası + rol.
- Rehberlik notları gizlilik seviyesi.
- Audit: kritik aksiyonlarda old/new, aktör, IP, sonuç.

## 8. Kabul (web uyarlaması)

- Ders yoklaması program + öğretmen oturumu ile tutarlı.
- Canlı görünüm renkleri (yeşil / sarı / kırmızı / gri / beyaz) doğru.
- Veli zaman tüneli giriş/çıkış ve ders olaylarını sırayla gösterir.
- Yetki matrisi ve audit log kritik işlemleri kaydeder.
- RFID teslim oranı **yok**; yerine web check-in olaylarının kaydı ve yoklama finalize kanıtı.
