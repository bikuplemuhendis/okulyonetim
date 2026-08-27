"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor, loginWithPassword, logout, requireActor, setActiveTenantCookie } from "@/lib/auth";
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
import {
  createTenant,
  deleteBranch,
  deleteBuilding,
  deleteClassroom,
  deleteCourse,
  deleteLocation,
  linkParent,
  removeSchedule,
  unlinkParent,
  updateTenantSettings,
  updateTenantStatus,
  upsertBranch,
  upsertBuilding,
  upsertClassroom,
  upsertCourse,
  upsertLocation,
  upsertSchedule,
  upsertStudent,
  upsertUser,
} from "@/lib/org";
import { homePath, assertTenant } from "@/lib/rbac";
import type { AttendanceStatus, LocationType, PrivacyLevel, Relationship, Role } from "@prisma/client";

function fd(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function bounce(path: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : "İşlem başarısız";
  redirect(`${path}?err=${encodeURIComponent(msg)}`);
}

async function runOrg(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    bounce(path, e);
  }
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

export async function switchTenantAction(form: FormData) {
  const actor = await requireActor();
  if (actor.role !== "PLATFORM_SUPER_ADMIN") throw new Error("Yetkisiz");
  const tenantId = fd(form, "tenantId");
  await setActiveTenantCookie(tenantId || null);
  revalidatePath("/", "layout");
}

export async function saveTenantSettings(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/ayarlar", () =>
    updateTenantSettings(actor, {
      id: fd(form, "id"),
      name: fd(form, "name"),
      taxNo: fd(form, "taxNo") || null,
      academicYearStart: fd(form, "academicYearStart"),
      academicYearEnd: fd(form, "academicYearEnd"),
      workStart: fd(form, "workStart"),
      workEnd: fd(form, "workEnd"),
      attendanceCorrectionHours: Number(fd(form, "attendanceCorrectionHours") || 48),
      lateThresholdMinutes: Number(fd(form, "lateThresholdMinutes") || 10),
      kvkkMasking: fd(form, "kvkkMasking") as "NONE" | "PHONE" | "EMAIL" | "BOTH",
      notificationChannels: form.getAll("channels").map(String),
      timezone: fd(form, "timezone") || undefined,
    }),
  );
  revalidatePath("/panel/ayarlar");
}

export async function saveBranch(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await runOrg(id ? `/panel/subeler/${id}` : "/panel/subeler", () =>
    upsertBranch(actor, {
      id: id || undefined,
      name: fd(form, "name"),
      code: fd(form, "code"),
      address: fd(form, "address"),
      city: fd(form, "city"),
      district: fd(form, "district"),
      phone: fd(form, "phone") || null,
      timezone: fd(form, "timezone") || "Europe/Istanbul",
      status: fd(form, "status") || "ACTIVE",
    }),
  );
  revalidatePath("/panel/subeler");
  revalidatePath("/panel/yapi");
}

export async function deleteBranchAction(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/subeler", () => deleteBranch(actor, fd(form, "id")));
  redirect("/panel/subeler");
}

export async function saveBuilding(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/binalar", () =>
    upsertBuilding(actor, {
      id: fd(form, "id") || undefined,
      branchId: fd(form, "branchId"),
      name: fd(form, "name"),
      status: fd(form, "status") || "ACTIVE",
    }),
  );
  revalidatePath("/panel/binalar");
  revalidatePath("/panel/lokasyonlar");
  revalidatePath("/panel/yapi");
}

export async function deleteBuildingAction(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/binalar", () => deleteBuilding(actor, fd(form, "id")));
  revalidatePath("/panel/binalar");
}

export async function saveLocation(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/lokasyonlar", () =>
    upsertLocation(actor, {
      id: fd(form, "id") || undefined,
      branchId: fd(form, "branchId"),
      name: fd(form, "name"),
      type: fd(form, "type") as LocationType,
      building: fd(form, "building") || null,
      floor: fd(form, "floor") || null,
      capacity: fd(form, "capacity") ? Number(fd(form, "capacity")) : null,
      direction: (fd(form, "direction") || "BOTH") as "IN" | "OUT" | "BOTH",
      status: fd(form, "status") || "ACTIVE",
    }),
  );
  revalidatePath("/panel/lokasyonlar");
  revalidatePath("/panel/yapi");
}

export async function deleteLocationAction(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/lokasyonlar", () => deleteLocation(actor, fd(form, "id")));
  revalidatePath("/panel/lokasyonlar");
}

export async function saveUser(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/kullanicilar", () =>
    upsertUser(actor, {
      id: fd(form, "id") || undefined,
      name: fd(form, "name"),
      email: fd(form, "email"),
      phone: fd(form, "phone") || null,
      password: fd(form, "password") || undefined,
      role: fd(form, "role") as Role,
      status: fd(form, "status") || "ACTIVE",
      branchIds: form.getAll("branchIds").map(String).filter(Boolean),
    }),
  );
  revalidatePath("/panel/kullanicilar");
}

export async function saveClassroom(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/siniflar", () =>
    upsertClassroom(actor, {
      id: fd(form, "id") || undefined,
      branchId: fd(form, "branchId"),
      name: fd(form, "name") || undefined,
      gradeLevel: fd(form, "gradeLevel"),
      section: fd(form, "section") || null,
      band: fd(form, "band") || null,
      advisorId: fd(form, "advisorId") || null,
      locationId: fd(form, "locationId") || null,
      status: fd(form, "status") || "ACTIVE",
    }),
  );
  revalidatePath("/panel/siniflar");
  revalidatePath("/panel/yapi");
}

export async function deleteClassroomAction(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/siniflar", () => deleteClassroom(actor, fd(form, "id")));
  revalidatePath("/panel/siniflar");
}

export async function saveCourse(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/dersler", () =>
    upsertCourse(actor, {
      id: fd(form, "id") || undefined,
      name: fd(form, "name"),
      subject: fd(form, "subject"),
      code: fd(form, "code"),
      durationMinutes: Number(fd(form, "durationMinutes") || 40),
      attendanceType: (fd(form, "attendanceType") || "LESSON") as "LESSON" | "STUDY",
    }),
  );
  revalidatePath("/panel/dersler");
}

export async function deleteCourseAction(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/dersler", () => deleteCourse(actor, fd(form, "id")));
  revalidatePath("/panel/dersler");
}

export async function saveSchedule(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/program", () =>
    upsertSchedule(actor, {
      id: fd(form, "id") || undefined,
      branchId: fd(form, "branchId"),
      classroomId: fd(form, "classroomId"),
      courseId: fd(form, "courseId"),
      teacherId: fd(form, "teacherId"),
      locationId: fd(form, "locationId"),
      dayOfWeek: Number(fd(form, "dayOfWeek")),
      startTime: fd(form, "startTime"),
      endTime: fd(form, "endTime"),
    }),
  );
  revalidatePath("/panel/program");
}

export async function deleteSchedule(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/program", () => removeSchedule(actor, fd(form, "id")));
  revalidatePath("/panel/program");
}

export async function saveStudent(form: FormData) {
  const actor = await requireActor();
  const parentEmail = fd(form, "parentEmail");
  const id = fd(form, "id");
  await runOrg(id ? `/panel/ogrenciler/${id}` : "/panel/ogrenciler", () =>
    upsertStudent(actor, {
      id: id || undefined,
      branchId: fd(form, "branchId"),
      classroomId: fd(form, "classroomId"),
      studentNo: fd(form, "studentNo"),
      name: fd(form, "name"),
      status: fd(form, "status") || "ACTIVE",
      studentEmail: fd(form, "studentEmail") || null,
      parent: parentEmail
        ? {
            name: fd(form, "parentName") || "Veli",
            email: parentEmail,
            phone: fd(form, "parentPhone"),
            relationship: (fd(form, "relationship") || "ANNE") as Relationship,
            kvkkConsent: form.get("kvkkConsent") === "on",
          }
        : null,
    }),
  );
  revalidatePath("/panel/ogrenciler");
}

export async function linkParentAction(form: FormData) {
  const actor = await requireActor();
  const studentId = fd(form, "studentId");
  await runOrg(`/panel/ogrenciler/${studentId}`, () =>
    linkParent(actor, {
      studentId,
      name: fd(form, "name"),
      email: fd(form, "email"),
      phone: fd(form, "phone"),
      relationship: (fd(form, "relationship") || "ANNE") as Relationship,
      kvkkConsent: form.get("kvkkConsent") === "on",
    }),
  );
  revalidatePath(`/panel/ogrenciler/${studentId}`);
}

export async function unlinkParentAction(form: FormData) {
  const actor = await requireActor();
  const studentId = fd(form, "studentId");
  await runOrg(`/panel/ogrenciler/${studentId}`, () => unlinkParent(actor, fd(form, "id")));
  revalidatePath(`/panel/ogrenciler/${studentId}`);
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
  const studentId = fd(form, "studentId");
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Öğrenci yok");
  assertTenant(actor, student.tenantId);
  await prisma.counselingRecord.create({
    data: {
      tenantId: student.tenantId,
      studentId,
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
  try {
    const tenant = await createTenant(actor, {
      name: fd(form, "name"),
      academicYearStart: fd(form, "academicYearStart") || "2026-09-01",
      academicYearEnd: fd(form, "academicYearEnd") || "2027-06-15",
      workStart: fd(form, "workStart") || "08:00",
      workEnd: fd(form, "workEnd") || "18:00",
      ownerName: fd(form, "ownerName") || undefined,
      ownerEmail: fd(form, "ownerEmail") || undefined,
      ownerPassword: fd(form, "ownerPassword") || undefined,
    });
    await setActiveTenantCookie(tenant.id);
  } catch (e) {
    bounce("/panel/firmalar", e);
  }
  revalidatePath("/panel/firmalar");
  revalidatePath("/", "layout");
}

export async function saveTenantStatus(form: FormData) {
  const actor = await requireActor();
  await runOrg("/panel/firmalar", () => updateTenantStatus(actor, fd(form, "id"), fd(form, "status")));
  revalidatePath("/panel/firmalar");
}

export async function getHomeRedirect() {
  const actor = await getActor();
  return actor ? homePath(actor.role) : "/login";
}
