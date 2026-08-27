import { AttendanceSource, AttendanceStatus, CheckInKind, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { Actor } from "./types";
import { assertBranch, assertTenant, canStartSession, tenantFilter } from "./rbac";
import {
  canCorrectAttendance,
  classifyAttendance,
  interpolateTemplate,
  inQuietHours,
  liveColor,
  parseCsv,
  shouldRateLimit,
  STUDENT_CSV_HEADERS,
  SCHEDULE_CSV_HEADERS,
  validateScheduleCsvRow,
  validateStudentCsvRow,
  applyKvkkMask,
} from "./domain";
import { clock, overlaps, timeToMinutes, DAY_LABELS } from "./time";
import { writeAudit } from "./audit";
import { parseJsonArray } from "./types";
import bcrypt from "bcryptjs";

function timeNow(date = new Date()) {
  return clock(date);
}

export async function loadTenant(actor: Actor) {
  if (!actor.tenantId) return null;
  return prisma.tenant.findUnique({ where: { id: actor.tenantId } });
}

export async function scopedBranches(actor: Actor) {
  const where: Prisma.BranchWhereInput = { ...tenantFilter(actor) };
  if (!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)) {
    where.id = { in: actor.branchIds };
  }
  return prisma.branch.findMany({ where, orderBy: { name: "asc" } });
}

export async function startSession(actor: Actor, scheduleId: string, dateStr?: string) {
  if (!canStartSession(actor.role)) throw new Error("Oturum başlatma yetkiniz yok.");
  const schedule = await prisma.lessonSchedule.findUnique({
    where: { id: scheduleId },
    include: { classroom: { include: { students: true } }, location: true, course: true },
  });
  if (!schedule) throw new Error("Ders programı bulunamadı.");
  assertTenant(actor, schedule.tenantId);
  assertBranch(actor, schedule.branchId);
  if (actor.role === "TEACHER" && schedule.teacherId !== actor.id) {
    throw new Error("Bu ders sizin oturumunuz değil.");
  }
  const date = dateStr || timeNow().dateStr;
  const existing = await prisma.lessonSession.findFirst({
    where: { scheduleId, date },
  });
  if (existing?.status === "FINALIZED") throw new Error("Oturum finalize edilmiş.");
  const session =
    existing ??
    (await prisma.lessonSession.create({
      data: {
        tenantId: schedule.tenantId,
        scheduleId,
        locationId: schedule.locationId,
        teacherId: schedule.teacherId,
        date,
        status: "PENDING",
      },
    }));

  const opened = await prisma.lessonSession.update({
    where: { id: session.id },
    data: { status: "OPEN", startedAt: new Date() },
  });

  const buffered = await prisma.attendance.findMany({
    where: { sessionId: session.id, status: "PENDING" },
  });
  const tenant = await prisma.tenant.findUnique({ where: { id: schedule.tenantId } });
  const threshold = tenant?.lateThresholdMinutes ?? 10;
  const nowMins = timeToMinutes(timeNow().timeStr);
  for (const row of buffered) {
    const status = classifyAttendance({
      checkInAtMinutes: nowMins,
      sessionStart: schedule.startTime,
      lateThresholdMinutes: threshold,
    });
    await prisma.attendance.update({
      where: { id: row.id },
      data: { status, source: row.source, markedAt: new Date() },
    });
  }

  for (const student of schedule.classroom.students.filter((s) => s.status === "ACTIVE")) {
    await prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      update: {},
      create: {
        sessionId: session.id,
        studentId: student.id,
        status: "PENDING",
        source: "SYSTEM",
      },
    });
  }

  await writeAudit({
    actor,
    tenantId: schedule.tenantId,
    branchId: schedule.branchId,
    action: "SESSION_START",
    entityType: "LessonSession",
    entityId: opened.id,
  });
  return opened;
}

export async function finalizeSession(actor: Actor, sessionId: string) {
  const session = await prisma.lessonSession.findUnique({
    where: { id: sessionId },
    include: { schedule: { include: { classroom: { include: { students: true } } } } },
  });
  if (!session) throw new Error("Oturum bulunamadı.");
  assertTenant(actor, session.tenantId);
  if (actor.role === "TEACHER" && session.teacherId !== actor.id) {
    throw new Error("Bu oturumu bitirme yetkiniz yok.");
  }
  if (session.status === "FINALIZED") return session;

  const rows = await prisma.attendance.findMany({ where: { sessionId } });
  for (const student of session.schedule.classroom.students.filter((s) => s.status === "ACTIVE")) {
    const row = rows.find((r) => r.studentId === student.id);
    if (!row || row.status === "PENDING") {
      const data = {
        status: "ABSENT" as AttendanceStatus,
        source: "SYSTEM" as AttendanceSource,
        markedAt: new Date(),
        markedById: actor.id,
      };
      if (row) {
        await prisma.attendance.update({ where: { id: row.id }, data });
      } else {
        await prisma.attendance.create({
          data: { sessionId, studentId: student.id, ...data },
        });
      }
      await prisma.incident.create({
        data: {
          tenantId: session.tenantId,
          branchId: session.schedule.branchId,
          studentId: student.id,
          locationId: session.locationId,
          sessionId: session.id,
          type: "ABSENCE",
          status: "OPEN",
          note: `${session.date} ders yoklaması — gelmedi`,
        },
      });
    }
  }

  const updated = await prisma.lessonSession.update({
    where: { id: sessionId },
    data: { status: "FINALIZED", endedAt: new Date() },
  });
  await writeAudit({
    actor,
    tenantId: session.tenantId,
    action: "SESSION_FINALIZE",
    entityType: "LessonSession",
    entityId: sessionId,
  });
  return updated;
}

export async function markAttendance(
  actor: Actor,
  opts: {
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    reason?: string;
    note?: string;
    source?: AttendanceSource;
  },
) {
  const session = await prisma.lessonSession.findUnique({
    where: { id: opts.sessionId },
    include: { schedule: true },
  });
  if (!session) throw new Error("Oturum bulunamadı.");
  assertTenant(actor, session.tenantId);

  if (session.status === "FINALIZED") {
    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
    const check = canCorrectAttendance({
      role: actor.role,
      finalizedAt: session.endedAt,
      windowHours: tenant?.attendanceCorrectionHours ?? 48,
      now: new Date(),
    });
    if (!check.ok) throw new Error(check.reason);
  } else if (actor.role === "TEACHER" && session.teacherId !== actor.id) {
    throw new Error("Bu sınıfın öğretmeni değilsiniz.");
  } else if (
    !["TEACHER", "BRANCH_MANAGER", "TENANT_OWNER", "BRANCH_OPS", "PLATFORM_SUPER_ADMIN"].includes(
      actor.role,
    )
  ) {
    throw new Error("Yoklama işaretleme yetkiniz yok.");
  }

  const existing = await prisma.attendance.findUnique({
    where: { sessionId_studentId: { sessionId: opts.sessionId, studentId: opts.studentId } },
  });
  const row = await prisma.attendance.upsert({
    where: { sessionId_studentId: { sessionId: opts.sessionId, studentId: opts.studentId } },
    update: {
      status: opts.status,
      source: opts.source ?? "TEACHER",
      reason: opts.reason,
      note: opts.note,
      markedAt: new Date(),
      markedById: actor.id,
    },
    create: {
      sessionId: opts.sessionId,
      studentId: opts.studentId,
      status: opts.status,
      source: opts.source ?? "TEACHER",
      reason: opts.reason,
      note: opts.note,
      markedById: actor.id,
    },
  });
  await writeAudit({
    actor,
    tenantId: session.tenantId,
    action: "ATTENDANCE_UPDATE",
    entityType: "Attendance",
    entityId: row.id,
    oldValue: existing,
    newValue: row,
  });
  if (opts.status === "LATE") {
    await prisma.incident.create({
      data: {
        tenantId: session.tenantId,
        branchId: session.schedule.branchId,
        studentId: opts.studentId,
        locationId: session.locationId,
        sessionId: session.id,
        type: "LATE",
        status: "OPEN",
        note: opts.reason || "Geç kaldı",
      },
    });
  }
  return row;
}

export async function performCheckIn(opts: {
  actor: Actor;
  studentId: string;
  locationId: string;
  source: AttendanceSource;
  kind?: CheckInKind;
}) {
  const location = await prisma.location.findUnique({ where: { id: opts.locationId } });
  if (!location || location.status !== "ACTIVE") throw new Error("Lokasyon aktif değil.");
  const student = await prisma.student.findUnique({
    where: { id: opts.studentId },
    include: { classroom: true },
  });
  if (!student) throw new Error("Öğrenci bulunamadı.");
  assertTenant(opts.actor, student.tenantId);

  const now = timeNow();
  let kind = opts.kind;
  if (!kind) {
    if (location.type === "GATE") kind = location.direction === "OUT" ? "GATE_OUT" : "GATE_IN";
    else if (location.type === "LIBRARY") kind = "LIBRARY";
    else kind = "CLASS";
  }

  if (kind === "GATE_IN" || kind === "GATE_OUT" || kind === "LIBRARY") {
    const event = await prisma.checkInEvent.create({
      data: {
        tenantId: student.tenantId,
        locationId: location.id,
        studentId: student.id,
        kind,
        result: "COUNTED",
        source: opts.source,
        timestamp: new Date(),
      },
    });
    return { event, message: kind === "GATE_OUT" ? "Okuldan çıkış kaydedildi." : "Giriş kaydedildi." };
  }

  const schedules = await prisma.lessonSchedule.findMany({
    where: {
      locationId: location.id,
      dayOfWeek: now.weekdayMon1,
    },
    include: { classroom: { include: { students: true } } },
  });
  const match = schedules.find((s) => overlaps(s.startTime, s.endTime, now.timeStr, now.timeStr));
  const inClass = match?.classroom.students.some((s) => s.id === student.id);

  if (!match || !inClass) {
    const event = await prisma.checkInEvent.create({
      data: {
        tenantId: student.tenantId,
        locationId: location.id,
        studentId: student.id,
        kind: "CLASS",
        result: "UNAUTHORIZED",
        source: opts.source,
        reason: "Plan dışı / yanlış lokasyon",
      },
    });
    await prisma.incident.create({
      data: {
        tenantId: student.tenantId,
        branchId: student.branchId,
        studentId: student.id,
        locationId: location.id,
        type: "UNAUTHORIZED",
        status: "OPEN",
        note: "Web check-in program dışı lokasyonda",
      },
    });
    return { event, message: "Plan dışı hareket — istisna açıldı." };
  }

  let session = await prisma.lessonSession.findFirst({
    where: { scheduleId: match.id, date: now.dateStr },
  });
  if (!session) {
    session = await prisma.lessonSession.create({
      data: {
        tenantId: match.tenantId,
        scheduleId: match.id,
        locationId: match.locationId,
        teacherId: match.teacherId,
        date: now.dateStr,
        status: "PENDING",
      },
    });
  }

  const existing = await prisma.attendance.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
  });
  if (existing && existing.status !== "PENDING" && existing.status !== "ABSENT") {
    const event = await prisma.checkInEvent.create({
      data: {
        tenantId: student.tenantId,
        locationId: location.id,
        studentId: student.id,
        sessionId: session.id,
        kind: "CLASS",
        result: "IGNORED",
        source: opts.source,
        reason: "Mükerrer check-in",
      },
    });
    return { event, message: "Mükerrer yoklama yok sayıldı." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: student.tenantId } });
  if (session.status === "OPEN" || session.status === "FINALIZED") {
    const status = classifyAttendance({
      checkInAtMinutes: timeToMinutes(now.timeStr),
      sessionStart: match.startTime,
      lateThresholdMinutes: tenant?.lateThresholdMinutes ?? 10,
    });
    await prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      update: { status, source: opts.source, markedAt: new Date() },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status,
        source: opts.source,
      },
    });
    const event = await prisma.checkInEvent.create({
      data: {
        tenantId: student.tenantId,
        locationId: location.id,
        studentId: student.id,
        sessionId: session.id,
        kind: "CLASS",
        result: "COUNTED",
        source: opts.source,
      },
    });
    return { event, message: status === "LATE" ? "Geç katılım kaydedildi." : "Yoklama kaydedildi." };
  }

  await prisma.attendance.upsert({
    where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    update: { status: "PENDING", source: opts.source },
    create: {
      sessionId: session.id,
      studentId: student.id,
      status: "PENDING",
      source: opts.source,
    },
  });
  const event = await prisma.checkInEvent.create({
    data: {
      tenantId: student.tenantId,
      locationId: location.id,
      studentId: student.id,
      sessionId: session.id,
      kind: "CLASS",
      result: "BUFFERED",
      source: opts.source,
      reason: "Öğretmen oturumu bekleniyor",
    },
  });
  return { event, message: "Öğretmen oturumu bekleniyor — yoklama tamponlandı." };
}

export async function liveBuilding(actor: Actor, branchId?: string) {
  const branches = await scopedBranches(actor);
  const bid = branchId || branches[0]?.id;
  if (!bid) return { branch: null, cards: [] as Awaited<ReturnType<typeof buildLiveCards>> };
  assertBranch(actor, bid);
  const branch = branches.find((b) => b.id === bid) ?? (await prisma.branch.findUnique({ where: { id: bid } }));
  const cards = await buildLiveCards(bid);
  return { branch, cards, branches };
}

async function buildLiveCards(branchId: string) {
  const now = timeNow();
  const locations = await prisma.location.findMany({
    where: { branchId },
    orderBy: [{ building: "asc" }, { floor: "asc" }, { name: "asc" }],
  });
  const schedules = await prisma.lessonSchedule.findMany({
    where: { branchId, dayOfWeek: now.weekdayMon1 },
    include: { course: true, teacher: true, classroom: { include: { _count: { select: { students: true } } } } },
  });
  const sessions = await prisma.lessonSession.findMany({
    where: { date: now.dateStr, schedule: { branchId } },
    include: { attendance: true },
  });
  const recent = await prisma.checkInEvent.findMany({
    where: {
      location: { branchId },
      timestamp: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });

  return locations.map((loc) => {
    const scheduled = schedules.find(
      (s) => s.locationId === loc.id && overlaps(s.startTime, s.endTime, now.timeStr, now.timeStr),
    );
    const session = scheduled
      ? sessions.find((s) => s.scheduleId === scheduled.id)
      : sessions.find((s) => s.locationId === loc.id && s.status === "OPEN");
    const locRecent = recent.filter((e) => e.locationId === loc.id);
    const unauthorized = locRecent.some((e) => e.result === "UNAUTHORIZED");
    const color = liveColor({
      locationStatus: loc.status,
      locationType: loc.type,
      hasScheduledNow: Boolean(scheduled),
      sessionStatus: session?.status ?? (scheduled ? "PENDING" : null),
      unauthorizedRecent: unauthorized,
    });
    const present =
      session?.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length ?? 0;
    const total = scheduled?.classroom._count.students ?? 0;
    const last = locRecent.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    return {
      location: loc,
      color,
      courseName: scheduled?.course.name ?? null,
      teacherName: scheduled?.teacher.name ?? null,
      sessionStatus: session?.status ?? null,
      present,
      total,
      lastCheckIn: last?.timestamp ?? null,
      unauthorized,
    };
  });
}

export async function dashboardMetrics(actor: Actor) {
  const tenantWhere = tenantFilter(actor);
  const now = timeNow();
  const branches = await scopedBranches(actor);
  const branchIds = branches.map((b) => b.id);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const schedules = await prisma.lessonSchedule.findMany({
    where: { ...tenantWhere, branchId: { in: branchIds } },
  });
  const sessions = await prisma.lessonSession.findMany({
    where: { ...tenantWhere, date: { gte: weekAgoDate(7) } },
    include: { schedule: true, attendance: true },
  });
  const plannedMinutes = schedules.reduce((acc, s) => {
    return acc + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
  }, 0);
  const realized = sessions.filter((s) => s.status === "FINALIZED" || s.status === "OPEN");
  const realizedMinutes = realized.reduce((acc, s) => {
    return acc + Math.max(0, timeToMinutes(s.schedule.endTime) - timeToMinutes(s.schedule.startTime));
  }, 0);

  const heatmap: { day: string; hour: number; absences: number; lates: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const date = weekAgoDate(d);
    for (let hour = 8; hour <= 17; hour++) {
      const cellSessions = sessions.filter((s) => {
        if (s.date !== date) return false;
        const startH = Number(s.schedule.startTime.slice(0, 2));
        return startH === hour;
      });
      heatmap.push({
        day: date,
        hour,
        absences: cellSessions.reduce(
          (a, s) => a + s.attendance.filter((x) => x.status === "ABSENT").length,
          0,
        ),
        lates: cellSessions.reduce(
          (a, s) => a + s.attendance.filter((x) => x.status === "LATE").length,
          0,
        ),
      });
    }
  }

  const locations = await prisma.location.findMany({
    where: { ...tenantWhere, branchId: { in: branchIds } },
  });
  const recentEvents = await prisma.checkInEvent.findMany({
    where: {
      ...tenantWhere,
      timestamp: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });
  const activeLocs = new Set(recentEvents.map((e) => e.locationId));
  const locationHealth = {
    active: activeLocs.size,
    idle: Math.max(0, locations.length - activeLocs.size),
    total: locations.length,
  };

  const todayAbsences = await prisma.attendance.count({
    where: { status: "ABSENT", session: { date: now.dateStr, tenantId: actor.tenantId ?? undefined } },
  });
  const todayLates = await prisma.attendance.count({
    where: { status: "LATE", session: { date: now.dateStr, tenantId: actor.tenantId ?? undefined } },
  });
  const openIncidents = await prisma.incident.count({
    where: { status: { in: ["OPEN", "CLASSIFIED"] }, tenantId: actor.tenantId ?? undefined },
  });

  return {
    branches,
    plannedMinutes,
    realizedMinutes,
    occupancy: plannedMinutes ? Math.round((realizedMinutes / (plannedMinutes * 5)) * 100) : 0,
    heatmap,
    locationHealth,
    todayAbsences,
    todayLates,
    openIncidents,
    studentCount: await prisma.student.count({
      where: { ...tenantWhere, status: "ACTIVE", branchId: { in: branchIds.length ? branchIds : undefined } },
    }),
  };
}

function weekAgoDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return clock(d).dateStr;
}

export async function sendBulkNotification(
  actor: Actor,
  opts: {
    templateId: string;
    studentIds: string[];
    channels: string[];
    bodyOverride?: string;
  },
) {
  if (!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "BRANCH_MANAGER", "BRANCH_OPS", "COUNSELOR"].includes(actor.role)) {
    throw new Error("Toplu bildirim yetkiniz yok.");
  }
  const template = await prisma.notificationTemplate.findUnique({ where: { id: opts.templateId } });
  if (!template || template.status !== "ACTIVE") throw new Error("Şablon aktif değil.");
  assertTenant(actor, template.tenantId);
  const now = timeNow();
  const created = [];
  for (const studentId of opts.studentIds) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { branch: true, parents: { include: { parent: true } }, prefs: true },
    });
    if (!student) continue;
    const last = await prisma.notificationRecord.findFirst({
      where: { studentId, templateId: template.id },
      orderBy: { createdAt: "desc" },
    });
    if (shouldRateLimit({ lastSentAt: last?.createdAt ?? null, now: new Date(), windowMinutes: 15 })) {
      continue;
    }
    const body = interpolateTemplate(opts.bodyOverride || template.body, {
      ogrenci_ad: student.name,
      tarih: now.dateStr,
      saat: now.timeStr,
      sube: student.branch.name,
    });
    for (const parentLink of student.parents) {
      const pref = student.prefs.find((p) => p.parentId === parentLink.parentId);
      const quiet = pref ? inQuietHours(now.timeStr, pref.quietStart, pref.quietEnd) : false;
      const prefChannels = pref ? parseJsonArray(pref.channels) : ["IN_APP", "PUSH"];
      for (const channel of opts.channels) {
        if (pref && !prefChannels.includes(channel) && channel !== "IN_APP") continue;
        const suppressed = quiet;
        const rec = await prisma.notificationRecord.create({
          data: {
            tenantId: student.tenantId,
            templateId: template.id,
            studentId: student.id,
            recipient: parentLink.parent.email,
            channel: channel as "IN_APP" | "SMS" | "PUSH" | "EMAIL",
            title: template.title,
            body,
            status: suppressed ? "SUPPRESSED" : "SENT",
            error: suppressed ? "Sessiz saat" : null,
          },
        });
        created.push(rec);
      }
    }
  }
  await writeAudit({
    actor,
    action: "BULK_SMS_SEND",
    entityType: "Notification",
    newValue: { count: created.length, template: template.name },
  });
  return created;
}

export async function importStudentsCsv(actor: Actor, branchId: string, csv: string) {
  if (!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER"].includes(actor.role)) {
    throw new Error("İçeri aktarma yetkiniz yok.");
  }
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new Error("Şube yok.");
  assertTenant(actor, branch.tenantId);
  const { headers, rows } = parseCsv(csv);
  const missing = STUDENT_CSV_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) throw new Error(`Eksik kolonlar: ${missing.join(", ")}`);
  const issues = rows.flatMap((r, i) => validateStudentCsvRow(r, i + 2));
  const created: string[] = [];
  const hash = await bcrypt.hash("Demo123!", 10);
  for (let i = 0; i < rows.length; i++) {
    if (issues.some((x) => x.row === i + 2)) continue;
    const row = rows[i];
    let classroom = await prisma.classroom.findFirst({
      where: { branchId, name: row.sinif },
    });
    if (!classroom) {
      classroom = await prisma.classroom.create({
        data: {
          tenantId: branch.tenantId,
          branchId,
          name: row.sinif,
          gradeLevel: row.sinif.split("-")[0] || row.sinif,
        },
      });
    }
    const student = await prisma.student.upsert({
      where: { branchId_studentNo: { branchId, studentNo: row.ogrenci_no } },
      update: { name: row.ad_soyad, classroomId: classroom.id },
      create: {
        tenantId: branch.tenantId,
        branchId,
        classroomId: classroom.id,
        studentNo: row.ogrenci_no,
        name: row.ad_soyad,
      },
    });
    if (row.veli_eposta) {
      const parent = await prisma.user.upsert({
        where: { email: row.veli_eposta.toLowerCase() },
        update: { name: row.veli_ad || row.veli_eposta, phone: row.veli_telefon },
        create: {
          tenantId: branch.tenantId,
          name: row.veli_ad || "Veli",
          email: row.veli_eposta.toLowerCase(),
          phone: row.veli_telefon,
          passwordHash: hash,
          role: "PARENT",
        },
      });
      await prisma.parentStudent.upsert({
        where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
        update: { kvkkConsent: true },
        create: {
          parentId: parent.id,
          studentId: student.id,
          relationship: (row.veli_iliski as "ANNE" | "BABA" | "VASI" | "DIGER") || "ANNE",
          kvkkConsent: true,
        },
      });
    }
    created.push(student.studentNo);
  }
  await writeAudit({
    actor,
    action: "CSV_IMPORT_STUDENTS",
    entityType: "Student",
    newValue: { created: created.length, errors: issues.length },
  });
  return { created: created.length, issues };
}

export async function importScheduleCsv(actor: Actor, csv: string) {
  if (!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)) {
    throw new Error("Program içeri aktarma yetkiniz yok.");
  }
  const { headers, rows } = parseCsv(csv);
  const missing = SCHEDULE_CSV_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) throw new Error(`Eksik kolonlar: ${missing.join(", ")}`);
  const issues = rows.flatMap((r, i) => validateScheduleCsvRow(r, i + 2));
  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    if (issues.some((x) => x.row === i + 2)) continue;
    const row = rows[i];
    const branch = await prisma.branch.findFirst({
      where: { code: row.sube_kodu, tenantId: actor.tenantId ?? undefined },
    });
    if (!branch) {
      issues.push({ row: i + 2, message: "Şube kodu bulunamadı" });
      continue;
    }
    const classroom = await prisma.classroom.findFirst({ where: { branchId: branch.id, name: row.sinif } });
    const course = await prisma.course.findFirst({
      where: { tenantId: branch.tenantId, code: row.ders_kodu },
    });
    const teacher = await prisma.user.findUnique({ where: { email: row.ogretmen_eposta.toLowerCase() } });
    const location = await prisma.location.findFirst({ where: { branchId: branch.id, name: row.lokasyon } });
    if (!classroom || !course || !teacher || !location) {
      issues.push({ row: i + 2, message: "Sınıf/ders/öğretmen/lokasyon eşleşmedi" });
      continue;
    }
    const clash = await prisma.lessonSchedule.findFirst({
      where: { locationId: location.id, dayOfWeek: Number(row.gun) },
    });
    if (clash && overlaps(clash.startTime, clash.endTime, row.baslangic, row.bitis)) {
      issues.push({ row: i + 2, message: "Lokasyon saati çakışıyor" });
      continue;
    }
    await prisma.lessonSchedule.create({
      data: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        classroomId: classroom.id,
        courseId: course.id,
        teacherId: teacher.id,
        locationId: location.id,
        dayOfWeek: Number(row.gun),
        startTime: row.baslangic,
        endTime: row.bitis,
      },
    });
    created++;
  }
  return { created, issues };
}

export function maskForActor(
  actor: Actor,
  policy: "NONE" | "PHONE" | "EMAIL" | "BOTH",
  value: { phone?: string | null; email?: string | null },
) {
  if (["TENANT_OWNER", "COUNSELOR", "PLATFORM_SUPER_ADMIN"].includes(actor.role)) {
    return { phone: value.phone ?? "—", email: value.email ?? "—" };
  }
  return applyKvkkMask(policy, value);
}

export { DAY_LABELS };
