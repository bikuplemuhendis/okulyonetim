# KampüsTakip — K12NET’i geçme planı

## Tasarım ilkeleri

1. WebForms menü ormanı değil: rol kokpiti + gruplu nav + öğrenci 360°.
2. Her kayıt bir kart/timeline; tablolar süzülebilir.
3. Veli/öğrenci yüzeyleri operasyon paneli kadar birinci sınıf.
4. KampüsTakip farklılaştırıcısı (canlı bina, kiosk, web yoklama) kaybolmaz.
5. Demo verisi her yeni modülü doldurur.

## 44 → şimdi / sonra

Şimdi (çalışan web, simüle ödeme/SMS): iletişim inbox, ödev, kayıt hunisi, not/sınav kaydı, ajanda, davranış, rehberlik (var), yoklama (var), etüt, sağlık, kulüp, ücret/kasa satırları, servis, program (var), belge paylaşımı, gradebook, ön kayıt, portallar, personel devam, konu, stok, nöbet, kütüphane, görev=iş emri basit, yemek menüsü, başarı, randevu, mezun statüsü (öğrenci GRADUATED), ziyaretçi.

Sonra (donanım/üçüncü parti): optik/online sınav motoru, soru bankası, POS, native app, SSO, e-Okul, LGS motoru, kantin POS, GPS servis.

## Veri

Assessment, GradeEntry, Homework(+Submission), CalendarEvent, InboxMessage, BehaviorRecord, HealthVisit, BusRoute(+Assignment), LibraryTitle(+Loan), FeeCharge, Club(+Membership), TutoringSlot, AdmissionLead, Survey(+Response), StaffAbsence, DutyShift, SharedDocument, VisitorLog, MealMenu, Achievement, ParentMeeting, LessonTopic, InventoryItem.

## IA grupları

Akademik: not, ödev, konu, etüt, kulüp  
Yaşam: takvim, mesaj, randevu, belge, anket  
Öğrenci hizmet: davranış, sağlık, servis, kütüphane, yemek, başarı  
Kurum: finans, kayıt, stok, ziyaretçi, nöbet, personel devam
