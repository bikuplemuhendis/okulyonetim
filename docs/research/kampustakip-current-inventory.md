# KampüsTakip mevcut envanter (2026-09-03)

Kaynak: `/workspace` çalışma ağacı.

## 1. Ürün

RFID’siz akıllı kampüs web uygulaması. Next.js 16 App Router, Prisma+SQLite, JWT, rol+şube, tenant izolasyonu.

## 2. Roller

PLATFORM_SUPER_ADMIN, TENANT_OWNER, TENANT_OPS, BRANCH_MANAGER, BRANCH_OPS, TEACHER, COUNSELOR, PARENT, STUDENT.

## 3. Rotalar

Kimlik: `/`, `/login`  
Panel: kokpit, firmalar, ayarlar, yapı, şubeler, binalar, lokasyonlar, kullanıcılar, sınıflar, dersler, program, öğrenciler, import, canlı, istisnalar, yoklama, mazeretler, duyurular, şablonlar, bildirimler, raporlar, denetim, rehberlik  
Veli: `/veli`, `/veli/devamsizlik`, `/veli/bildirimler`  
Öğrenci: `/ogrenci`  
Kiosk: `/kiosk/[locationId]`  
API: `/api/health`, `/api/reports/students.csv`

## 4. Veri modeli (çekirdek)

Tenant, Branch, Building, Location, User, Classroom, Course, Student, ParentStudent, LessonSchedule, LessonSession, Attendance, CheckInEvent, Incident, CounselingRecord, ExcuseRequest, Announcement, Notification*, AuditLog.

## 5. UI kalitesi

Temel teal/turuncu token’lar, kart+tablo, Geist. Modern ama SIS derinliği yok; veli/öğrenci yüzeyleri ince (sadece zaman tüneli / yoklama).

## 6. SIS boşlukları

Yok: not, ödev, mesaj, takvim, davranış puanı, sağlık, servis, kütüphane ödünç, ücret, kulüp, etüt, aday kayıt, anket, personel devam, nöbet, belge merkezi, ziyaretçi, yemek, rozet, veli randevu, stok, konu/müfredat, LMS/sınav motoru, native app, SSO, POS.
