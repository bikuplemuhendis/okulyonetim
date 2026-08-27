"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getActor, loginWithPassword, logout, requestMeta, requireActor } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  finalizeSession,
  importScheduleCsv,
  importStudentsCsv,
  markAttendance,
  performCheckIn,
  sendBulkNotification,
  startSession,
} from "@/lib/services";
import { homePath } from "@/lib/rbac";
import type { AttendanceStatus, LocationType, PrivacyLevel, Role } from "@prisma/client";

function fd(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function loginAction(_prev: unknown, form: FormData) {
  const res = await loginWithPassword(fd(form, "email"), fd(form, "password"));
  if ("error" in res && res.error) return { error: res.error };
  redirect(res.path!);
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function saveTenantSettings(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  if (!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"].includes(actor.role)) {
    throw new Error("Yetkisiz");
  }
  const channels = form.getAll("channels").map(String);
  await prisma.tenant.update({
    where: { id },
    data: {
      name: fd(form, "name"),
      taxNo: fd(form, "taxNo") || null,
      workStart: fd(form, "workStart"),
      workEnd: fd(form, "workEnd"),
      attendanceCorrectionHours: Number(fd(form, "attendanceCorrectionHours") || 48),
      lateThresholdMinutes: Number(fd(form, "lateThresholdMinutes") || 10),
      kvkkMasking: fd(form, "kvkkMasking") as "NONE" | "PHONE" | "EMAIL" | "BOTH",
      notificationChannels: JSON.stringify(channels.length ? channels : ["IN_APP"]),
    },
  });
  const meta = await requestMeta();
  await writeAudit({ actor, action: "TENANT_UPDATE", entityType: "Tenant", entityId: id, ...meta });
  revalidatePath("/panel/ayarlar");
}

export async function saveBranch(form: FormData) {
  const actor = await requireActor();
  const tenantId = actor.tenantId;
  if (!tenantId) throw new Error("Tenant yok");
  const id = fd(form, "id");
  const data = {
    tenantId,
    name: fd(form, "name"),
    code: fd(form, "code"),
    address: fd(form, "address"),
    city: fd(form, "city"),
    district: fd(form, "district"),
    phone: fd(form, "phone") || null,
    timezone: fd(form, "timezone") || "Europe/Istanbul",
    status: fd(form, "status") || "ACTIVE",
  };
  if (id) await prisma.branch.update({ where: { id }, data });
  else await prisma.branch.create({ data });
  await writeAudit({ actor, action: id ? "BRANCH_UPDATE" : "BRANCH_CREATE", entityType: "Branch", entityId: id });
  revalidatePath("/panel/subeler");
}

export async function saveLocation(form: FormData) {
  const actor = await requireActor();
  const tenantId = actor.tenantId!;
  const id = fd(form, "id");
  const data = {
    tenantId,
    branchId: fd(form, "branchId"),
    name: fd(form, "name"),
    type: fd(form, "type") as LocationType,
    building: fd(form, "building") || null,
    floor: fd(form, "floor") || null,
    capacity: fd(form, "capacity") ? Number(fd(form, "capacity")) : null,
    direction: (fd(form, "direction") || "BOTH") as "IN" | "OUT" | "BOTH",
    status: fd(form, "status") || "ACTIVE",
  };
  if (id) await prisma.location.update({ where: { id }, data });
  else await prisma.location.create({ data });
  revalidatePath("/panel/lokasyonlar");
}

export async function saveUser(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  const email = fd(form, "email").toLowerCase();
  const branches = form.getAll("branchIds").map(String);
  const password = fd(form, "password");
  const data = {
    tenantId: actor.tenantId,
    name: fd(form, "name"),
    email,
    phone: fd(form, "phone") || null,
    role: fd(form, "role") as Role,
    status: fd(form, "status") || "ACTIVE",
  };
  if (id) {
    await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    await prisma.userBranchScope.deleteMany({ where: { userId: id } });
    await prisma.userBranchScope.createMany({ data: branches.map((branchId) => ({ userId: id, branchId })) });
  } else {
    const user = await prisma.user.create({
      data: {
        ...data,
        passwordHash: await bcrypt.hash(password || "Demo123!", 10),
      },
    });
    await prisma.userBranchScope.createMany({
      data: branches.map((branchId) => ({ userId: user.id, branchId })),
    });
  }
  const meta = await requestMeta();
  await writeAudit({ actor, action: "USER_UPSERT", entityType: "User", newValue: { email, role: data.role }, ...meta });
  revalidatePath("/panel/kullanicilar");
}

export async function saveClassroom(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  const data = {
    tenantId: actor.tenantId!,
    branchId: fd(form, "branchId"),
    name: fd(form, "name"),
    gradeLevel: fd(form, "gradeLevel"),
    advisorId: fd(form, "advisorId") || null,
    locationId: fd(form, "locationId") || null,
    status: fd(form, "status") || "ACTIVE",
  };
  if (id) await prisma.classroom.update({ where: { id }, data });
  else await prisma.classroom.create({ data });
  revalidatePath("/panel/siniflar");
}

export async function saveCourse(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  const data = {
    tenantId: actor.tenantId!,
    name: fd(form, "name"),
    subject: fd(form, "subject"),
    code: fd(form, "code"),
    durationMinutes: Number(fd(form, "durationMinutes") || 40),
    attendanceType: (fd(form, "attendanceType") || "LESSON") as "LESSON" | "STUDY",
  };
  if (id) await prisma.course.update({ where: { id }, data });
  else await prisma.course.create({ data });
  revalidatePath("/panel/dersler");
}

export async function saveSchedule(form: FormData) {
  const actor = await requireActor();
  await prisma.lessonSchedule.create({
    data: {
      tenantId: actor.tenantId!,
      branchId: fd(form, "branchId"),
      classroomId: fd(form, "classroomId"),
      courseId: fd(form, "courseId"),
      teacherId: fd(form, "teacherId"),
      locationId: fd(form, "locationId"),
      dayOfWeek: Number(fd(form, "dayOfWeek")),
      startTime: fd(form, "startTime"),
      endTime: fd(form, "endTime"),
    },
  });
  revalidatePath("/panel/program");
}

export async function deleteSchedule(form: FormData) {
  await requireActor();
  await prisma.lessonSchedule.delete({ where: { id: fd(form, "id") } });
  revalidatePath("/panel/program");
}

export async function saveStudent(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  const data = {
    tenantId: actor.tenantId!,
    branchId: fd(form, "branchId"),
    classroomId: fd(form, "classroomId"),
    studentNo: fd(form, "studentNo"),
    name: fd(form, "name"),
    status: fd(form, "status") || "ACTIVE",
  };
  if (id) await prisma.student.update({ where: { id }, data });
  else await prisma.student.create({ data });
  revalidatePath("/panel/ogrenciler");
}

export async function startSessionAction(form: FormData) {
  const actor = await requireActor();
  const session = await startSession(actor, fd(form, "scheduleId"), fd(form, "date") || undefined);
  revalidatePath("/panel/yoklama");
  redirect(`/panel/yoklama/${session.id}`);
}

export async function finalizeSessionAction(form: FormData) {
  const actor = await requireActor();
  await finalizeSession(actor, fd(form, "sessionId"));
  revalidatePath("/panel/yoklama");
}

export async function markAttendanceAction(form: FormData) {
  const actor = await requireActor();
  await markAttendance(actor, {
    sessionId: fd(form, "sessionId"),
    studentId: fd(form, "studentId"),
    status: fd(form, "status") as AttendanceStatus,
    reason: fd(form, "reason") || undefined,
    note: fd(form, "note") || undefined,
  });
  revalidatePath(`/panel/yoklama/${fd(form, "sessionId")}`);
}

export async function checkInAction(form: FormData) {
  const actor = await requireActor();
  const studentNo = fd(form, "studentNo");
  const locationId = fd(form, "locationId");
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) throw new Error("Lokasyon yok");
  const student = await prisma.student.findFirst({
    where: { studentNo, branchId: location.branchId },
  });
  if (!student) throw new Error("Öğrenci numarası bu şubede yok.");
  const result = await performCheckIn({
    actor,
    studentId: student.id,
    locationId,
    source: "KIOSK",
  });
  return { message: result.message };
}

export async function studentSelfCheckIn() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT" || !actor.studentId) throw new Error("Öğrenci hesabı gerekli");
  const student = await prisma.student.findUnique({ where: { id: actor.studentId } });
  if (!student) throw new Error("Öğrenci yok");
  const classroom = await prisma.classroom.findUnique({ where: { id: student.classroomId } });
  const locationId = classroom?.locationId;
  if (!locationId) {
    const loc = await prisma.location.findFirst({
      where: { branchId: student.branchId, type: "CLASSROOM" },
    });
    if (!loc) throw new Error("Sınıf lokasyonu yok");
    const result = await performCheckIn({
      actor,
      studentId: student.id,
      locationId: loc.id,
      source: "STUDENT_WEB",
    });
    revalidatePath("/ogrenci");
    return result.message;
  }
  const result = await performCheckIn({
    actor,
    studentId: student.id,
    locationId,
    source: "STUDENT_WEB",
  });
  revalidatePath("/ogrenci");
  return result.message;
}

export async function saveCounseling(form: FormData) {
  const actor = await requireActor();
  if (actor.role !== "COUNSELOR" && actor.role !== "TENANT_OWNER" && actor.role !== "PLATFORM_SUPER_ADMIN") {
    throw new Error("Yetkisiz");
  }
  await prisma.counselingRecord.create({
    data: {
      tenantId: actor.tenantId!,
      studentId: fd(form, "studentId"),
      counselorId: actor.id,
      occurredAt: new Date(fd(form, "occurredAt") || Date.now()),
      topic: fd(form, "topic"),
      notes: fd(form, "notes"),
      privacy: fd(form, "privacy") as PrivacyLevel,
      actionPlan: fd(form, "actionPlan") || null,
      nextMeeting: fd(form, "nextMeeting") ? new Date(fd(form, "nextMeeting")) : null,
    },
  });
  await writeAudit({ actor, action: "COUNSELING_CREATE", entityType: "CounselingRecord", entityId: fd(form, "studentId") });
  revalidatePath(`/panel/rehberlik/${fd(form, "studentId")}`);
}

export async function saveAnnouncement(form: FormData) {
  const actor = await requireActor();
  await prisma.announcement.create({
    data: {
      tenantId: actor.tenantId!,
      branchId: fd(form, "branchId") || null,
      title: fd(form, "title"),
      body: fd(form, "body"),
      audience: JSON.stringify(form.getAll("audience").map(String)),
      authorId: actor.id,
    },
  });
  revalidatePath("/panel/duyurular");
}

export async function saveTemplate(form: FormData) {
  const actor = await requireActor();
  await prisma.notificationTemplate.create({
    data: {
      tenantId: actor.tenantId!,
      name: fd(form, "name"),
      channel: fd(form, "channel") as "IN_APP" | "SMS" | "PUSH" | "EMAIL",
      title: fd(form, "title") || null,
      body: fd(form, "body"),
      status: fd(form, "status") || "ACTIVE",
    },
  });
  revalidatePath("/panel/sablonlar");
}

export async function bulkNotifyAction(form: FormData) {
  const actor = await requireActor();
  const studentIds = fd(form, "studentIds")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await sendBulkNotification(actor, {
    templateId: fd(form, "templateId"),
    studentIds,
    channels: form.getAll("channels").map(String),
    bodyOverride: fd(form, "body") || undefined,
  });
  revalidatePath("/panel/istisnalar");
  revalidatePath("/panel/bildirimler");
}

export async function closeIncident(form: FormData) {
  const actor = await requireActor();
  await prisma.incident.update({
    where: { id: fd(form, "id") },
    data: { status: fd(form, "status") as "CLASSIFIED" | "ACTIONED" | "CLOSED", note: fd(form, "note") || undefined },
  });
  await writeAudit({ actor, action: "INCIDENT_UPDATE", entityType: "Incident", entityId: fd(form, "id") });
  revalidatePath("/panel/istisnalar");
}

export async function reviewExcuse(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  const status = fd(form, "status") as "APPROVED" | "REJECTED";
  const excuse = await prisma.excuseRequest.update({
    where: { id },
    data: { status, reviewNote: fd(form, "reviewNote") || null },
  });
  if (status === "APPROVED") {
    const sessions = await prisma.lessonSession.findMany({
      where: { date: excuse.date, schedule: { classroom: { students: { some: { id: excuse.studentId } } } } },
    });
    for (const s of sessions) {
      await prisma.attendance.updateMany({
        where: { sessionId: s.id, studentId: excuse.studentId },
        data: { status: "EXCUSED", reason: "Mazeret onaylandı" },
      });
    }
  }
  await writeAudit({ actor, action: "EXCUSE_REVIEW", entityType: "ExcuseRequest", entityId: id, newValue: { status } });
  revalidatePath("/panel/mazeretler");
}

export async function submitExcuse(form: FormData) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") throw new Error("Yalnızca veli mazeret bildirir.");
  await prisma.excuseRequest.create({
    data: {
      tenantId: actor.tenantId!,
      studentId: fd(form, "studentId"),
      parentId: actor.id,
      date: fd(form, "date"),
      reason: fd(form, "reason"),
    },
  });
  revalidatePath("/veli/devamsizlik");
}

export async function saveParentPrefs(form: FormData) {
  const actor = await requireActor();
  await prisma.notificationPreference.upsert({
    where: { parentId_studentId: { parentId: actor.id, studentId: fd(form, "studentId") } },
    update: {
      gateIn: form.get("gateIn") === "on",
      gateOut: form.get("gateOut") === "on",
      late: form.get("late") === "on",
      absence: form.get("absence") === "on",
      lateThresholdMinutes: Number(fd(form, "lateThresholdMinutes") || 10),
      channels: JSON.stringify(form.getAll("channels").map(String)),
      quietStart: fd(form, "quietStart") || null,
      quietEnd: fd(form, "quietEnd") || null,
    },
    create: {
      parentId: actor.id,
      studentId: fd(form, "studentId"),
      gateIn: form.get("gateIn") === "on",
      gateOut: form.get("gateOut") === "on",
      late: form.get("late") === "on",
      absence: form.get("absence") === "on",
      lateThresholdMinutes: Number(fd(form, "lateThresholdMinutes") || 10),
      channels: JSON.stringify(form.getAll("channels").map(String)),
      quietStart: fd(form, "quietStart") || null,
      quietEnd: fd(form, "quietEnd") || null,
    },
  });
  revalidatePath("/veli/bildirimler");
}

export async function importStudentsAction(_prev: unknown, form: FormData) {
  const actor = await requireActor();
  try {
    const result = await importStudentsCsv(actor, fd(form, "branchId"), fd(form, "csv"));
    revalidatePath("/panel/import");
    return { ok: true as const, ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import hatası" };
  }
}

export async function importScheduleAction(_prev: unknown, form: FormData) {
  const actor = await requireActor();
  try {
    const result = await importScheduleCsv(actor, fd(form, "csv"));
    revalidatePath("/panel/import");
    return { ok: true as const, ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import hatası" };
  }
}

export async function saveTenant(form: FormData) {
  const actor = await requireActor();
  if (actor.role !== "PLATFORM_SUPER_ADMIN") throw new Error("Yetkisiz");
  await prisma.tenant.create({
    data: {
      name: fd(form, "name"),
      academicYearStart: new Date(fd(form, "academicYearStart") || "2026-09-01"),
      academicYearEnd: new Date(fd(form, "academicYearEnd") || "2027-06-15"),
      workStart: fd(form, "workStart") || "08:00",
      workEnd: fd(form, "workEnd") || "18:00",
    },
  });
  revalidatePath("/panel/firmalar");
}

export async function getHomeRedirect() {
  const actor = await getActor();
  return actor ? homePath(actor.role) : "/login";
}
