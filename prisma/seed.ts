import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { clock, minutesToTime, timeToMinutes } from "../src/lib/time";

const prisma = new PrismaClient();
const PASSWORD = "Demo123!";

async function wipe() {
  const models = [
    "notificationRecord",
    "notificationPreference",
    "notificationTemplate",
    "auditLog",
    "excuseRequest",
    "counselingRecord",
    "incident",
    "checkInEvent",
    "attendance",
    "lessonSession",
    "lessonSchedule",
    "parentStudent",
    "student",
    "announcement",
    "userBranchScope",
    "classroom",
    "course",
    "location",
    "user",
    "branch",
    "tenant",
  ] as const;
  for (const m of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[m].deleteMany();
  }
}

async function main() {
  await wipe();
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = clock();

  await prisma.user.create({
    data: {
      name: "Platform Yöneticisi",
      email: "super@kampus.local",
      phone: "+905550000001",
      passwordHash: hash,
      role: "PLATFORM_SUPER_ADMIN",
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: "X Kolejleri",
      taxNo: "1234567890",
      academicYearStart: new Date("2026-09-01"),
      academicYearEnd: new Date("2027-06-15"),
      workStart: "08:00",
      workEnd: "18:00",
      attendanceCorrectionHours: 48,
      lateThresholdMinutes: 10,
      kvkkMasking: "PHONE",
      notificationChannels: JSON.stringify(["IN_APP", "PUSH", "SMS", "EMAIL"]),
      timezone: "Europe/Istanbul",
    },
  });

  const cankaya = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: "Çankaya Şubesi",
      code: "ANK-01",
      address: "Çankaya Mah. Okul Cad. No:12 Çankaya",
      city: "Ankara",
      district: "Çankaya",
      phone: "+903124001010",
    },
  });
  const kadikoy = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: "Kadıköy Şubesi",
      code: "IST-01",
      address: "Caferağa Mah. Moda Cad. No:8 Kadıköy",
      city: "İstanbul",
      district: "Kadıköy",
      phone: "+902164001010",
    },
  });

  const users: { name: string; email: string; role: Role; branches: string[]; phone: string }[] = [
    { name: "Ahmet Yönetici", email: "sahip@xkolej.local", role: "TENANT_OWNER", branches: [], phone: "+905551010101" },
    { name: "Selin Operasyon", email: "operasyon@xkolej.local", role: "TENANT_OPS", branches: [], phone: "+905551010102" },
    { name: "Murat Şube Müdürü", email: "mudur@cankaya.local", role: "BRANCH_MANAGER", branches: [cankaya.id], phone: "+905551010103" },
    { name: "Gül Sekreter", email: "sekreter@cankaya.local", role: "BRANCH_OPS", branches: [cankaya.id], phone: "+905551010104" },
    { name: "Ayşe Yılmaz", email: "ogretmen@cankaya.local", role: "TEACHER", branches: [cankaya.id], phone: "+905551010105" },
    { name: "Mehmet Demir", email: "ogretmen2@cankaya.local", role: "TEACHER", branches: [cankaya.id], phone: "+905551010106" },
    { name: "Elif Rehber", email: "rehberlik@cankaya.local", role: "COUNSELOR", branches: [cankaya.id], phone: "+905551010107" },
    { name: "Deniz Kadıköy Müdür", email: "mudur@kadikoy.local", role: "BRANCH_MANAGER", branches: [kadikoy.id], phone: "+905551010108" },
    { name: "Can İstanbul Öğretmen", email: "ogretmen@kadikoy.local", role: "TEACHER", branches: [kadikoy.id], phone: "+905551010109" },
  ];

  const createdUsers: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        passwordHash: hash,
        role: u.role,
        scopes: { create: u.branches.map((branchId) => ({ branchId })) },
      },
    });
    createdUsers[u.email] = row.id;
  }

  const loc12A = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      name: "12-A Kapısı",
      type: "CLASSROOM",
      building: "Bina A",
      floor: "2. Kat",
      capacity: 28,
    },
  });
  const loc12B = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      name: "12-B Kapısı",
      type: "CLASSROOM",
      building: "Bina A",
      floor: "2. Kat",
      capacity: 26,
    },
  });
  const gate = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      name: "Ana Giriş Turnikesi",
      type: "GATE",
      building: "Bina A",
      floor: "Zemin",
      direction: "BOTH",
    },
  });
  const library = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      name: "Kütüphane",
      type: "LIBRARY",
      building: "Bina B",
      floor: "1. Kat",
      capacity: 40,
    },
  });
  const loc9A = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      branchId: kadikoy.id,
      name: "9-A Kapısı",
      type: "CLASSROOM",
      building: "Ana Bina",
      floor: "1. Kat",
      capacity: 30,
    },
  });
  await prisma.location.create({
    data: {
      tenantId: tenant.id,
      branchId: kadikoy.id,
      name: "Kadıköy Ana Giriş",
      type: "GATE",
      building: "Ana Bina",
      floor: "Zemin",
      direction: "BOTH",
    },
  });

  const c12A = await prisma.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      name: "12-A",
      gradeLevel: "12",
      advisorId: createdUsers["ogretmen@cankaya.local"],
      locationId: loc12A.id,
    },
  });
  const c12B = await prisma.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      name: "12-B",
      gradeLevel: "12",
      advisorId: createdUsers["ogretmen2@cankaya.local"],
      locationId: loc12B.id,
    },
  });
  const c9A = await prisma.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: kadikoy.id,
      name: "9-A",
      gradeLevel: "9",
      advisorId: createdUsers["ogretmen@kadikoy.local"],
      locationId: loc9A.id,
    },
  });

  const mat = await prisma.course.create({
    data: { tenantId: tenant.id, name: "Matematik", subject: "Sayısal", code: "MAT101", durationMinutes: 40 },
  });
  const tur = await prisma.course.create({
    data: { tenantId: tenant.id, name: "Türkçe", subject: "Sözel", code: "TUR101", durationMinutes: 40 },
  });
  const fiz = await prisma.course.create({
    data: { tenantId: tenant.id, name: "Fizik", subject: "Sayısal", code: "FIZ101", durationMinutes: 40 },
  });
  const ing = await prisma.course.create({
    data: { tenantId: tenant.id, name: "İngilizce", subject: "Dil", code: "ING101", durationMinutes: 40 },
  });

  const names12A = [
    "Mehmet Kaya",
    "Elif Şahin",
    "Can Yıldız",
    "Zeynep Arslan",
    "Ali Koç",
    "Ayşe Demir",
    "Burak Çelik",
    "Deniz Aydın",
  ];
  const names12B = ["Ece Kurt", "Emre Acar", "Merve Polat", "Hakan Öz", "İrem Güneş", "Yusuf Tan"];
  const names9A = ["Ada Kılıç", "Berk Uçar", "Cemre Aksoy", "Doruk Eren", "Ela Sönmez"];

  async function makeStudents(
    names: string[],
    classroomId: string,
    branchId: string,
    prefix: string,
    firstEmail?: { student?: string; parent?: string },
  ) {
    const out = [];
    for (let i = 0; i < names.length; i++) {
      const studentNo = `${prefix}${String(i + 1).padStart(3, "0")}`;
      const isFirst = i === 0 && firstEmail;
      const studentUser =
        isFirst && firstEmail.student
          ? await prisma.user.create({
              data: {
                tenantId: tenant.id,
                name: names[i],
                email: firstEmail.student,
                phone: `+90555300${prefix.slice(-2)}${i + 1}`,
                passwordHash: hash,
                role: "STUDENT",
                scopes: { create: [{ branchId }] },
              },
            })
          : null;
      const student = await prisma.student.create({
        data: {
          tenantId: tenant.id,
          branchId,
          classroomId,
          userId: studentUser?.id,
          studentNo,
          name: names[i],
        },
      });
      const parentEmail = isFirst && firstEmail.parent ? firstEmail.parent : `veli.${studentNo.toLowerCase()}@xkolej.local`;
      const parent = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: `${names[i].split(" ").slice(-1)[0]} Veli`,
          email: parentEmail,
          phone: `+905554${prefix.slice(-2)}${String(i + 10).padStart(4, "0")}`,
          passwordHash: hash,
          role: "PARENT",
          scopes: { create: [{ branchId }] },
        },
      });
      await prisma.parentStudent.create({
        data: {
          parentId: parent.id,
          studentId: student.id,
          relationship: i % 2 === 0 ? "ANNE" : "BABA",
          kvkkConsent: true,
        },
      });
      await prisma.notificationPreference.create({
        data: {
          parentId: parent.id,
          studentId: student.id,
          quietStart: "22:00",
          quietEnd: "07:00",
          channels: JSON.stringify(["IN_APP", "PUSH", "SMS"]),
        },
      });
      out.push(student);
    }
    return out;
  }

  const s12A = await makeStudents(names12A, c12A.id, cankaya.id, "202612", {
    student: "ogrenci@cankaya.local",
    parent: "veli@cankaya.local",
  });
  await makeStudents(names12B, c12B.id, cankaya.id, "202613");
  await makeStudents(names9A, c9A.id, kadikoy.id, "202609");

  const teacherA = createdUsers["ogretmen@cankaya.local"];
  const teacherB = createdUsers["ogretmen2@cankaya.local"];
  const teacherK = createdUsers["ogretmen@kadikoy.local"];

  const weekly: {
    classroomId: string;
    courseId: string;
    teacherId: string;
    locationId: string;
    branchId: string;
    start: string;
    end: string;
    days: number[];
  }[] = [
    { classroomId: c12A.id, courseId: mat.id, teacherId: teacherA, locationId: loc12A.id, branchId: cankaya.id, start: "08:30", end: "09:10", days: [1, 2, 3, 4, 5] },
    { classroomId: c12A.id, courseId: tur.id, teacherId: teacherB, locationId: loc12A.id, branchId: cankaya.id, start: "09:20", end: "10:00", days: [1, 2, 3, 4, 5] },
    { classroomId: c12A.id, courseId: fiz.id, teacherId: teacherA, locationId: loc12A.id, branchId: cankaya.id, start: "10:10", end: "10:50", days: [1, 3, 5] },
    { classroomId: c12A.id, courseId: ing.id, teacherId: teacherB, locationId: loc12A.id, branchId: cankaya.id, start: "11:00", end: "11:40", days: [2, 4] },
    { classroomId: c12B.id, courseId: mat.id, teacherId: teacherB, locationId: loc12B.id, branchId: cankaya.id, start: "08:30", end: "09:10", days: [1, 2, 3, 4, 5] },
    { classroomId: c12B.id, courseId: fiz.id, teacherId: teacherA, locationId: loc12B.id, branchId: cankaya.id, start: "09:20", end: "10:00", days: [1, 4] },
    { classroomId: c9A.id, courseId: mat.id, teacherId: teacherK, locationId: loc9A.id, branchId: kadikoy.id, start: "08:40", end: "09:20", days: [1, 2, 3, 4, 5] },
    { classroomId: c9A.id, courseId: ing.id, teacherId: teacherK, locationId: loc9A.id, branchId: kadikoy.id, start: "09:30", end: "10:10", days: [2, 4] },
  ];

  const scheduleRows = [];
  for (const w of weekly) {
    for (const day of w.days) {
      scheduleRows.push(
        await prisma.lessonSchedule.create({
          data: {
            tenantId: tenant.id,
            branchId: w.branchId,
            classroomId: w.classroomId,
            courseId: w.courseId,
            teacherId: w.teacherId,
            locationId: w.locationId,
            dayOfWeek: day,
            startTime: w.start,
            endTime: w.end,
          },
        }),
      );
    }
  }

  const nowMins = timeToMinutes(now.timeStr);
  const liveStart = minutesToTime(Math.max(8 * 60, nowMins - 20));
  const liveEnd = minutesToTime(nowMins + 25);
  const yellowStart = minutesToTime(Math.max(8 * 60, nowMins - 10));
  const yellowEnd = minutesToTime(nowMins + 30);

  const liveSchedule = await prisma.lessonSchedule.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      classroomId: c12A.id,
      courseId: mat.id,
      teacherId: teacherA,
      locationId: loc12A.id,
      dayOfWeek: now.weekdayMon1,
      startTime: liveStart,
      endTime: liveEnd,
    },
  });
  const yellowSchedule = await prisma.lessonSchedule.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      classroomId: c12B.id,
      courseId: tur.id,
      teacherId: teacherB,
      locationId: loc12B.id,
      dayOfWeek: now.weekdayMon1,
      startTime: yellowStart,
      endTime: yellowEnd,
    },
  });

  const liveSession = await prisma.lessonSession.create({
    data: {
      tenantId: tenant.id,
      scheduleId: liveSchedule.id,
      locationId: loc12A.id,
      teacherId: teacherA,
      date: now.dateStr,
      status: "OPEN",
      startedAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  });
  await prisma.lessonSession.create({
    data: {
      tenantId: tenant.id,
      scheduleId: yellowSchedule.id,
      locationId: loc12B.id,
      teacherId: teacherB,
      date: now.dateStr,
      status: "PENDING",
    },
  });

  for (let i = 0; i < s12A.length; i++) {
    const st = i < 5 ? (i === 4 ? "LATE" : "PRESENT") : i === 7 ? "ABSENT" : "PENDING";
    await prisma.attendance.create({
      data: {
        sessionId: liveSession.id,
        studentId: s12A[i].id,
        status: st,
        source: st === "PRESENT" || st === "LATE" ? "KIOSK" : "SYSTEM",
        reason: st === "LATE" ? "Kapıda kuyruk" : undefined,
      },
    });
  }

  for (const student of s12A.slice(0, 6)) {
    await prisma.checkInEvent.create({
      data: {
        tenantId: tenant.id,
        locationId: gate.id,
        studentId: student.id,
        kind: "GATE_IN",
        result: "COUNTED",
        source: "KIOSK",
        timestamp: new Date(Date.now() - 90 * 60 * 1000),
      },
    });
  }
  await prisma.checkInEvent.create({
    data: {
      tenantId: tenant.id,
      locationId: loc12A.id,
      studentId: s12A[0].id,
      sessionId: liveSession.id,
      kind: "CLASS",
      result: "COUNTED",
      source: "STUDENT_WEB",
    },
  });
  await prisma.checkInEvent.create({
    data: {
      tenantId: tenant.id,
      locationId: library.id,
      studentId: s12A[2].id,
      kind: "LIBRARY",
      result: "COUNTED",
      source: "KIOSK",
      timestamp: new Date(Date.now() - 40 * 60 * 1000),
    },
  });

  const pastDays = 8;
  for (let d = 1; d <= pastDays; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    const parts = clock(dt);
    if (parts.weekdayMon1 > 5) continue;
    const daySchedules = scheduleRows.filter((s) => s.dayOfWeek === parts.weekdayMon1 && s.classroomId === c12A.id);
    for (const sch of daySchedules.slice(0, 2)) {
      const sess = await prisma.lessonSession.create({
        data: {
          tenantId: tenant.id,
          scheduleId: sch.id,
          locationId: sch.locationId,
          teacherId: sch.teacherId,
          date: parts.dateStr,
          status: "FINALIZED",
          startedAt: new Date(dt.getTime() + 8 * 3600 * 1000),
          endedAt: new Date(dt.getTime() + 9 * 3600 * 1000),
        },
      });
      for (let i = 0; i < s12A.length; i++) {
        const roll = (i + d) % 7;
        const status = roll === 0 ? "ABSENT" : roll === 1 ? "LATE" : "PRESENT";
        await prisma.attendance.create({
          data: {
            sessionId: sess.id,
            studentId: s12A[i].id,
            status,
            source: "TEACHER",
          },
        });
        if (status === "ABSENT" && d === 1) {
          await prisma.incident.create({
            data: {
              tenantId: tenant.id,
              branchId: cankaya.id,
              studentId: s12A[i].id,
              locationId: sch.locationId,
              sessionId: sess.id,
              type: "ABSENCE",
              note: `${parts.dateStr} gelmedi`,
            },
          });
        }
      }
    }
  }

  await prisma.incident.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      studentId: s12A[7].id,
      locationId: loc12A.id,
      sessionId: liveSession.id,
      type: "ABSENCE",
      note: "Bugünkü açık oturumda henüz yok",
    },
  });
  await prisma.incident.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      studentId: s12A[3].id,
      locationId: loc12B.id,
      type: "UNAUTHORIZED",
      note: "Yanlış sınıf kapısı kiosk denemesi",
    },
  });

  await prisma.counselingRecord.create({
    data: {
      tenantId: tenant.id,
      studentId: s12A[0].id,
      counselorId: createdUsers["rehberlik@cankaya.local"],
      occurredAt: new Date(Date.now() - 3 * 86400 * 1000),
      topic: "Ders Başarısı",
      notes: "Matematik netlerinde düşüş konuşuldu. Etüt planı önerildi.",
      privacy: "MEDIUM",
      actionPlan: "Haftada 2 etüt + veli bilgilendirme",
      nextMeeting: new Date(Date.now() + 7 * 86400 * 1000),
    },
  });
  await prisma.counselingRecord.create({
    data: {
      tenantId: tenant.id,
      studentId: s12A[7].id,
      counselorId: createdUsers["rehberlik@cankaya.local"],
      occurredAt: new Date(Date.now() - 1 * 86400 * 1000),
      topic: "Devamsızlık",
      notes: "Aile içi durum nedeniyle sabah geç kalmalar. Yüksek gizlilik.",
      privacy: "HIGH",
      actionPlan: "Rehberlik takibi",
    },
  });

  await prisma.excuseRequest.create({
    data: {
      tenantId: tenant.id,
      studentId: s12A[5].id,
      parentId: (await prisma.parentStudent.findFirst({ where: { studentId: s12A[5].id } }))!.parentId,
      date: now.dateStr,
      reason: "Doktor randevusu (sabah)",
      status: "PENDING",
    },
  });

  const tAbsence = await prisma.notificationTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Devamsızlık Uyarısı",
      channel: "SMS",
      title: "Devamsızlık",
      body: "{ogrenci_ad} öğrencimiz {tarih} tarihinde derse katılmadı. Şube: {sube}.",
    },
  });
  await prisma.notificationTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Geç Kalma",
      channel: "PUSH",
      title: "Geç kalma",
      body: "{ogrenci_ad} {saat} itibarıyla derse geç kaldı.",
    },
  });
  await prisma.notificationTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Okula Giriş",
      channel: "PUSH",
      title: "Okula giriş",
      body: "{ogrenci_ad} {saat} itibarıyla {sube} giriş yaptı.",
    },
  });

  await prisma.notificationRecord.create({
    data: {
      tenantId: tenant.id,
      templateId: tAbsence.id,
      studentId: s12A[7].id,
      recipient: "veli@cankaya.local",
      channel: "SMS",
      title: "Devamsızlık",
      body: "Deniz Aydın öğrencimiz bugün 1. derse katılmadı.",
      status: "SENT",
    },
  });

  await prisma.announcement.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      title: "Yaz sonu etüt programı",
      body: "Çankaya şubesinde 1-5 Eylül etüt saatleri 08:30-12:00 arasında uygulanacaktır.",
      audience: JSON.stringify(["PARENT", "STUDENT", "TEACHER"]),
      authorId: createdUsers["mudur@cankaya.local"],
    },
  });
  await prisma.announcement.create({
    data: {
      tenantId: tenant.id,
      title: "KVKK aydınlatma metni güncellendi",
      body: "Veli açık rıza ve aydınlatma metinleri 2026-2027 akademik yılı için yenilendi.",
      audience: JSON.stringify(["PARENT"]),
      authorId: createdUsers["sahip@xkolej.local"],
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      branchId: cankaya.id,
      actorId: createdUsers["ogretmen@cankaya.local"],
      action: "SESSION_START",
      entityType: "LessonSession",
      entityId: liveSession.id,
      result: "SUCCESS",
      ip: "127.0.0.1",
      userAgent: "seed",
    },
  });

  console.log("Seed tamam. Demo parola:", PASSWORD);
  console.log("Girişler: super@kampus.local, sahip@xkolej.local, mudur@cankaya.local, ogretmen@cankaya.local, rehberlik@cankaya.local, veli@cankaya.local, ogrenci@cankaya.local");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
