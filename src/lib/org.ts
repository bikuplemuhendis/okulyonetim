import bcrypt from "bcryptjs";
import type { LocationDirection, LocationType, Relationship, Role } from "@prisma/client";
import { prisma } from "./prisma";
import type { Actor } from "./types";
import { DEMO_PASSWORD } from "./types";
import {
  assertBranch,
  assertTenant,
  canAssignRole,
  canManageAcademic,
  canManageBranches,
  canManageStaff,
  canManageStudents,
  requireTenantId,
} from "./rbac";
import { composeClassroomName, inferGradeBand } from "./domain";
import { overlaps, timeToMinutes } from "./time";
import { writeAudit } from "./audit";

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function requireText(value: string, label: string, min: number, max: number) {
  const v = value.trim();
  if (v.length < min || v.length > max) {
    throw new Error(`${label} ${min}-${max} karakter olmalı.`);
  }
  return v;
}

export function validateAcademicRange(start: Date, end: Date) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new Error("Akademik yıl başlangıcı geçersiz.");
  }
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new Error("Akademik yıl bitişi geçersiz.");
  }
  if (start >= end) throw new Error("Akademik yıl başlangıcı bitişten önce olmalı.");
}

export async function createTenant(
  actor: Actor,
  input: {
    name: string;
    academicYearStart: string;
    academicYearEnd: string;
    workStart?: string;
    workEnd?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPassword?: string;
  },
) {
  if (actor.role !== "PLATFORM_SUPER_ADMIN") throw new Error("Yetkisiz");
  const name = requireText(input.name, "Firma adı", 2, 120);
  const academicYearStart = new Date(input.academicYearStart);
  const academicYearEnd = new Date(input.academicYearEnd);
  validateAcademicRange(academicYearStart, academicYearEnd);
  const tenant = await prisma.tenant.create({
    data: {
      name,
      academicYearStart,
      academicYearEnd,
      workStart: input.workStart || "08:00",
      workEnd: input.workEnd || "18:00",
    },
  });
  if (input.ownerEmail) {
    const email = input.ownerEmail.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Bu e-posta zaten kayıtlı.");
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: requireText(input.ownerName || "Firma Sahibi", "Sahip adı", 2, 80),
        email,
        passwordHash: await bcrypt.hash(input.ownerPassword || DEMO_PASSWORD, 10),
        role: "TENANT_OWNER",
        status: "ACTIVE",
      },
    });
  }
  await writeAudit({
    actor,
    tenantId: tenant.id,
    action: "TENANT_CREATE",
    entityType: "Tenant",
    entityId: tenant.id,
    newValue: { name: tenant.name },
  });
  return tenant;
}

export async function updateTenantStatus(actor: Actor, tenantId: string, status: string) {
  if (actor.role !== "PLATFORM_SUPER_ADMIN") throw new Error("Yetkisiz");
  if (!["ACTIVE", "PASSIVE", "SUSPENDED"].includes(status)) throw new Error("Geçersiz durum.");
  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existing) throw new Error("Firma bulunamadı.");
  const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: { status } });
  await writeAudit({
    actor,
    tenantId,
    action: "TENANT_STATUS",
    entityType: "Tenant",
    entityId: tenantId,
    oldValue: { status: existing.status },
    newValue: { status },
  });
  return tenant;
}

export async function updateTenantSettings(
  actor: Actor,
  input: {
    id: string;
    name: string;
    taxNo?: string | null;
    academicYearStart: string;
    academicYearEnd: string;
    workStart: string;
    workEnd: string;
    attendanceCorrectionHours: number;
    lateThresholdMinutes: number;
    kvkkMasking: "NONE" | "PHONE" | "EMAIL" | "BOTH";
    notificationChannels: string[];
    timezone?: string;
  },
) {
  if (!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"].includes(actor.role)) {
    throw new Error("Yetkisiz");
  }
  const existing = await prisma.tenant.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Firma bulunamadı.");
  assertTenant(actor, existing.id);
  if (actor.role !== "PLATFORM_SUPER_ADMIN" && actor.tenantId !== existing.id) {
    throw new Error("Tenant kapsamı dışında.");
  }
  const academicYearStart = new Date(input.academicYearStart);
  const academicYearEnd = new Date(input.academicYearEnd);
  validateAcademicRange(academicYearStart, academicYearEnd);
  if (timeToMinutes(input.workStart) >= timeToMinutes(input.workEnd)) {
    throw new Error("Çalışma başlangıcı bitişten önce olmalı.");
  }
  const channels = input.notificationChannels.filter(Boolean);
  const tenant = await prisma.tenant.update({
    where: { id: existing.id },
    data: {
      name: requireText(input.name, "Firma adı", 2, 120),
      taxNo: input.taxNo?.trim() || null,
      academicYearStart,
      academicYearEnd,
      workStart: input.workStart,
      workEnd: input.workEnd,
      attendanceCorrectionHours: clampInt(input.attendanceCorrectionHours, 0, 168),
      lateThresholdMinutes: clampInt(input.lateThresholdMinutes, 0, 60),
      kvkkMasking: input.kvkkMasking,
      notificationChannels: JSON.stringify(channels.length ? channels : ["IN_APP"]),
      timezone: input.timezone || existing.timezone,
    },
  });
  await writeAudit({
    actor,
    tenantId: tenant.id,
    action: "TENANT_UPDATE",
    entityType: "Tenant",
    entityId: tenant.id,
  });
  return tenant;
}

async function loadBranchInScope(actor: Actor, branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new Error("Şube bulunamadı.");
  assertTenant(actor, branch.tenantId);
  assertBranch(actor, branch.id);
  return branch;
}

export async function upsertBranch(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    code: string;
    address: string;
    city: string;
    district: string;
    phone?: string | null;
    timezone?: string;
    status?: string;
  },
) {
  if (!canManageBranches(actor.role)) throw new Error("Şube yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const name = requireText(input.name, "Şube adı", 2, 120);
  const code = requireText(input.code, "Şube kodu", 2, 32).toUpperCase();
  const address = requireText(input.address, "Adres", 10, 500);
  const data = {
    name,
    code,
    address,
    city: requireText(input.city, "İl", 2, 80),
    district: requireText(input.district, "İlçe", 2, 80),
    phone: input.phone?.trim() || null,
    timezone: input.timezone || "Europe/Istanbul",
    status: input.status === "PASSIVE" ? "PASSIVE" : "ACTIVE",
  };
  if (input.id) {
    const existing = await loadBranchInScope(actor, input.id);
    const row = await prisma.branch.update({ where: { id: existing.id }, data });
    await writeAudit({
      actor,
      tenantId: existing.tenantId,
      branchId: existing.id,
      action: "BRANCH_UPDATE",
      entityType: "Branch",
      entityId: existing.id,
    });
    return row;
  }
  const row = await prisma.branch.create({ data: { ...data, tenantId } });
  await writeAudit({
    actor,
    tenantId,
    branchId: row.id,
    action: "BRANCH_CREATE",
    entityType: "Branch",
    entityId: row.id,
  });
  return row;
}

export async function deleteBranch(actor: Actor, id: string) {
  if (!canManageBranches(actor.role)) throw new Error("Şube silme yetkiniz yok.");
  const existing = await loadBranchInScope(actor, id);
  const students = await prisma.student.count({ where: { branchId: id } });
  if (students > 0) {
    throw new Error("Öğrencisi olan şube silinemez. Önce öğrencileri taşıyın veya pasifleştirin.");
  }
  await prisma.branch.delete({ where: { id } });
  await writeAudit({
    actor,
    tenantId: existing.tenantId,
    action: "BRANCH_DELETE",
    entityType: "Branch",
    entityId: id,
    oldValue: { name: existing.name, code: existing.code },
  });
}

export async function upsertBuilding(
  actor: Actor,
  input: { id?: string; branchId: string; name: string; status?: string },
) {
  if (!canManageAcademic(actor.role)) throw new Error("Bina yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const branch = await loadBranchInScope(actor, input.branchId);
  const name = requireText(input.name, "Bina adı", 2, 80);
  const status = input.status === "PASSIVE" ? "PASSIVE" : "ACTIVE";
  if (input.id) {
    const existing = await prisma.building.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Bina bulunamadı.");
    assertTenant(actor, existing.tenantId);
    assertBranch(actor, existing.branchId);
    if (existing.name !== name) {
      await prisma.location.updateMany({
        where: { branchId: existing.branchId, building: existing.name },
        data: { building: name },
      });
    }
    const row = await prisma.building.update({
      where: { id: existing.id },
      data: { name, status, branchId: branch.id },
    });
    await writeAudit({
      actor,
      tenantId,
      branchId: branch.id,
      action: "BUILDING_UPDATE",
      entityType: "Building",
      entityId: row.id,
    });
    return row;
  }
  const row = await prisma.building.upsert({
    where: { branchId_name: { branchId: branch.id, name } },
    update: { status },
    create: { tenantId, branchId: branch.id, name, status },
  });
  await writeAudit({
    actor,
    tenantId,
    branchId: branch.id,
    action: "BUILDING_UPSERT",
    entityType: "Building",
    entityId: row.id,
  });
  return row;
}

export async function deleteBuilding(actor: Actor, id: string) {
  if (!canManageAcademic(actor.role)) throw new Error("Bina silme yetkiniz yok.");
  const existing = await prisma.building.findUnique({ where: { id } });
  if (!existing) throw new Error("Bina bulunamadı.");
  assertTenant(actor, existing.tenantId);
  assertBranch(actor, existing.branchId);
  const used = await prisma.location.count({
    where: { branchId: existing.branchId, building: existing.name },
  });
  if (used > 0) throw new Error("Bu binaya bağlı lokasyon var. Önce lokasyonları güncelleyin.");
  await prisma.building.delete({ where: { id } });
  await writeAudit({
    actor,
    tenantId: existing.tenantId,
    action: "BUILDING_DELETE",
    entityType: "Building",
    entityId: id,
  });
}

export async function upsertLocation(
  actor: Actor,
  input: {
    id?: string;
    branchId: string;
    name: string;
    type: LocationType;
    building?: string | null;
    floor?: string | null;
    capacity?: number | null;
    direction?: LocationDirection;
    status?: string;
  },
) {
  if (!canManageAcademic(actor.role)) throw new Error("Lokasyon yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const branch = await loadBranchInScope(actor, input.branchId);
  const name = requireText(input.name, "Lokasyon adı", 2, 120);
  const building = input.building?.trim() || null;
  const data = {
    branchId: branch.id,
    name,
    type: input.type,
    building,
    floor: input.floor?.trim() || null,
    capacity: input.capacity && input.capacity > 0 ? clampInt(input.capacity, 0, 200) : null,
    direction: input.direction || "BOTH",
    status: input.status === "PASSIVE" ? "PASSIVE" : "ACTIVE",
  };
  if (building) {
    await prisma.building.upsert({
      where: { branchId_name: { branchId: branch.id, name: building } },
      update: {},
      create: { tenantId, branchId: branch.id, name: building },
    });
  }
  if (input.id) {
    const existing = await prisma.location.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Lokasyon bulunamadı.");
    assertTenant(actor, existing.tenantId);
    assertBranch(actor, existing.branchId);
    const row = await prisma.location.update({ where: { id: existing.id }, data });
    await writeAudit({
      actor,
      tenantId: existing.tenantId,
      branchId: existing.branchId,
      action: "LOCATION_UPDATE",
      entityType: "Location",
      entityId: existing.id,
    });
    return row;
  }
  const row = await prisma.location.create({ data: { ...data, tenantId } });
  await writeAudit({
    actor,
    tenantId,
    branchId: branch.id,
    action: "LOCATION_CREATE",
    entityType: "Location",
    entityId: row.id,
  });
  return row;
}

export async function deleteLocation(actor: Actor, id: string) {
  if (!canManageAcademic(actor.role)) throw new Error("Lokasyon silme yetkiniz yok.");
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) throw new Error("Lokasyon bulunamadı.");
  assertTenant(actor, existing.tenantId);
  assertBranch(actor, existing.branchId);
  const schedules = await prisma.lessonSchedule.count({ where: { locationId: id } });
  if (schedules > 0) throw new Error("Programa bağlı lokasyon silinemez.");
  await prisma.location.delete({ where: { id } });
  await writeAudit({
    actor,
    tenantId: existing.tenantId,
    action: "LOCATION_DELETE",
    entityType: "Location",
    entityId: id,
  });
}

export async function upsertClassroom(
  actor: Actor,
  input: {
    id?: string;
    branchId: string;
    name?: string;
    gradeLevel: string;
    section?: string | null;
    band?: string | null;
    advisorId?: string | null;
    locationId?: string | null;
    status?: string;
  },
) {
  if (!canManageAcademic(actor.role)) throw new Error("Sınıf yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const branch = await loadBranchInScope(actor, input.branchId);
  const gradeLevel = requireText(input.gradeLevel, "Seviye", 1, 20);
  const section = input.section?.trim() || null;
  const name = requireText(input.name?.trim() || composeClassroomName(gradeLevel, section), "Sınıf adı", 1, 40);
  const band = input.band?.trim() || inferGradeBand(gradeLevel);
  const advisorId = input.advisorId || null;
  if (advisorId) {
    const advisor = await prisma.user.findUnique({ where: { id: advisorId } });
    if (!advisor) throw new Error("Danışman bulunamadı.");
    assertTenant(actor, advisor.tenantId);
  }
  const locationId = input.locationId || null;
  if (locationId) {
    const loc = await prisma.location.findUnique({ where: { id: locationId } });
    if (!loc) throw new Error("Lokasyon bulunamadı.");
    assertTenant(actor, loc.tenantId);
    if (loc.branchId !== branch.id) throw new Error("Lokasyon bu şubeye ait değil.");
  }
  const data = {
    branchId: branch.id,
    name,
    gradeLevel,
    section,
    band,
    advisorId,
    locationId,
    status: input.status === "PASSIVE" ? "PASSIVE" : "ACTIVE",
  };
  if (input.id) {
    const existing = await prisma.classroom.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Sınıf bulunamadı.");
    assertTenant(actor, existing.tenantId);
    assertBranch(actor, existing.branchId);
    const row = await prisma.classroom.update({ where: { id: existing.id }, data });
    await writeAudit({
      actor,
      tenantId: existing.tenantId,
      branchId: existing.branchId,
      action: "CLASSROOM_UPDATE",
      entityType: "Classroom",
      entityId: existing.id,
    });
    return row;
  }
  const row = await prisma.classroom.create({ data: { ...data, tenantId } });
  await writeAudit({
    actor,
    tenantId,
    branchId: branch.id,
    action: "CLASSROOM_CREATE",
    entityType: "Classroom",
    entityId: row.id,
  });
  return row;
}

export async function deleteClassroom(actor: Actor, id: string) {
  if (!canManageAcademic(actor.role)) throw new Error("Sınıf silme yetkiniz yok.");
  const existing = await prisma.classroom.findUnique({ where: { id } });
  if (!existing) throw new Error("Sınıf bulunamadı.");
  assertTenant(actor, existing.tenantId);
  assertBranch(actor, existing.branchId);
  const students = await prisma.student.count({ where: { classroomId: id } });
  if (students > 0) throw new Error("Öğrencisi olan sınıf silinemez.");
  await prisma.classroom.delete({ where: { id } });
  await writeAudit({
    actor,
    tenantId: existing.tenantId,
    action: "CLASSROOM_DELETE",
    entityType: "Classroom",
    entityId: id,
  });
}

export async function upsertCourse(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    subject: string;
    code: string;
    durationMinutes: number;
    attendanceType: "LESSON" | "STUDY";
  },
) {
  if (!canManageAcademic(actor.role)) throw new Error("Ders yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const data = {
    name: requireText(input.name, "Ders adı", 2, 80),
    subject: requireText(input.subject, "Branş", 2, 80),
    code: requireText(input.code, "Ders kodu", 2, 20).toUpperCase(),
    durationMinutes: clampInt(input.durationMinutes || 40, 10, 240),
    attendanceType: input.attendanceType,
  };
  if (input.id) {
    const existing = await prisma.course.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Ders bulunamadı.");
    assertTenant(actor, existing.tenantId);
    const row = await prisma.course.update({ where: { id: existing.id }, data });
    await writeAudit({ actor, tenantId: existing.tenantId, action: "COURSE_UPDATE", entityType: "Course", entityId: existing.id });
    return row;
  }
  const row = await prisma.course.create({ data: { ...data, tenantId } });
  await writeAudit({ actor, tenantId, action: "COURSE_CREATE", entityType: "Course", entityId: row.id });
  return row;
}

export async function deleteCourse(actor: Actor, id: string) {
  if (!canManageAcademic(actor.role)) throw new Error("Ders silme yetkiniz yok.");
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw new Error("Ders bulunamadı.");
  assertTenant(actor, existing.tenantId);
  const used = await prisma.lessonSchedule.count({ where: { courseId: id } });
  if (used > 0) throw new Error("Programa bağlı ders silinemez.");
  await prisma.course.delete({ where: { id } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "COURSE_DELETE", entityType: "Course", entityId: id });
}

export async function upsertSchedule(
  actor: Actor,
  input: {
    id?: string;
    branchId: string;
    classroomId: string;
    courseId: string;
    teacherId: string;
    locationId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  },
) {
  if (!canManageAcademic(actor.role)) throw new Error("Program yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const branch = await loadBranchInScope(actor, input.branchId);
  const dayOfWeek = clampInt(input.dayOfWeek, 1, 7);
  if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
    throw new Error("Başlangıç saati bitişten önce olmalı.");
  }
  const classroom = await prisma.classroom.findUnique({ where: { id: input.classroomId } });
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!classroom || !course || !teacher || !location) throw new Error("Sınıf/ders/öğretmen/lokasyon eksik.");
  assertTenant(actor, classroom.tenantId);
  assertTenant(actor, course.tenantId);
  assertTenant(actor, teacher.tenantId);
  assertTenant(actor, location.tenantId);
  if (classroom.branchId !== branch.id) throw new Error("Sınıf bu şubeye ait değil.");
  if (location.branchId !== branch.id) throw new Error("Lokasyon bu şubeye ait değil.");
  if (teacher.role !== "TEACHER" && teacher.role !== "BRANCH_MANAGER") {
    throw new Error("Öğretmen olarak yalnızca öğretmen veya şube müdürü seçilebilir.");
  }

  const clashWhere = { dayOfWeek, id: input.id ? { not: input.id } : undefined };
  const locationClashes = await prisma.lessonSchedule.findMany({
    where: { ...clashWhere, locationId: location.id },
  });
  if (locationClashes.some((c) => overlaps(c.startTime, c.endTime, input.startTime, input.endTime))) {
    throw new Error("Aynı lokasyonda saat çakışması var.");
  }
  const teacherClashes = await prisma.lessonSchedule.findMany({
    where: { ...clashWhere, teacherId: teacher.id },
  });
  if (teacherClashes.some((c) => overlaps(c.startTime, c.endTime, input.startTime, input.endTime))) {
    throw new Error("Öğretmenin aynı saatte başka dersi var.");
  }
  const classClashes = await prisma.lessonSchedule.findMany({
    where: { ...clashWhere, classroomId: classroom.id },
  });
  if (classClashes.some((c) => overlaps(c.startTime, c.endTime, input.startTime, input.endTime))) {
    throw new Error("Sınıfın aynı saatte başka dersi var.");
  }

  const data = {
    branchId: branch.id,
    classroomId: classroom.id,
    courseId: course.id,
    teacherId: teacher.id,
    locationId: location.id,
    dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
  };
  if (input.id) {
    const existing = await prisma.lessonSchedule.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Program satırı bulunamadı.");
    assertTenant(actor, existing.tenantId);
    const row = await prisma.lessonSchedule.update({ where: { id: existing.id }, data });
    await writeAudit({
      actor,
      tenantId: existing.tenantId,
      action: "SCHEDULE_UPDATE",
      entityType: "LessonSchedule",
      entityId: existing.id,
    });
    return row;
  }
  const row = await prisma.lessonSchedule.create({ data: { ...data, tenantId } });
  await writeAudit({
    actor,
    tenantId,
    action: "SCHEDULE_CREATE",
    entityType: "LessonSchedule",
    entityId: row.id,
  });
  return row;
}

export async function removeSchedule(actor: Actor, id: string) {
  if (!canManageAcademic(actor.role)) throw new Error("Program silme yetkiniz yok.");
  const existing = await prisma.lessonSchedule.findUnique({ where: { id } });
  if (!existing) throw new Error("Program satırı bulunamadı.");
  assertTenant(actor, existing.tenantId);
  assertBranch(actor, existing.branchId);
  await prisma.lessonSchedule.delete({ where: { id } });
  await writeAudit({
    actor,
    tenantId: existing.tenantId,
    action: "SCHEDULE_DELETE",
    entityType: "LessonSchedule",
    entityId: id,
  });
}

export async function upsertUser(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    email: string;
    phone?: string | null;
    password?: string;
    role: Role;
    status?: string;
    branchIds: string[];
  },
) {
  if (!canManageStaff(actor.role)) throw new Error("Kullanıcı yönetimi yetkiniz yok.");
  if (!canAssignRole(actor.role, input.role)) throw new Error("Bu rolü atama yetkiniz yok.");
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Geçerli e-posta girin.");
  const name = requireText(input.name, "Ad soyad", 2, 80);
  const tenantId = input.role === "PLATFORM_SUPER_ADMIN" ? null : requireTenantId(actor);
  if (input.role !== "PLATFORM_SUPER_ADMIN" && input.role !== "TENANT_OWNER" && input.role !== "TENANT_OPS") {
    if (!input.branchIds.length) throw new Error("Şube kapsamı en az 1 seçilmeli.");
  }
  for (const branchId of input.branchIds) {
    await loadBranchInScope(actor, branchId);
  }
  const status = input.status === "PASSIVE" ? "PASSIVE" : "ACTIVE";
  if (input.id) {
    const existing = await prisma.user.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Kullanıcı bulunamadı.");
    if (existing.role === "PLATFORM_SUPER_ADMIN" && actor.role !== "PLATFORM_SUPER_ADMIN") {
      throw new Error("Yetkisiz");
    }
    if (existing.tenantId) assertTenant(actor, existing.tenantId);
    const row = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        email,
        phone: input.phone?.trim() || null,
        role: input.role,
        status,
        tenantId,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
      },
    });
    await prisma.userBranchScope.deleteMany({ where: { userId: existing.id } });
    if (input.branchIds.length) {
      await prisma.userBranchScope.createMany({
        data: input.branchIds.map((branchId) => ({ userId: existing.id, branchId })),
      });
    }
    await writeAudit({
      actor,
      tenantId,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: existing.id,
      newValue: { email, role: input.role, status },
    });
    return row;
  }
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) throw new Error("Bu e-posta zaten kayıtlı.");
  const user = await prisma.user.create({
    data: {
      tenantId,
      name,
      email,
      phone: input.phone?.trim() || null,
      role: input.role,
      status,
      passwordHash: await bcrypt.hash(input.password || DEMO_PASSWORD, 10),
    },
  });
  if (input.branchIds.length) {
    await prisma.userBranchScope.createMany({
      data: input.branchIds.map((branchId) => ({ userId: user.id, branchId })),
    });
  }
  await writeAudit({
    actor,
    tenantId,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    newValue: { email, role: input.role },
  });
  return user;
}

export async function upsertStudent(
  actor: Actor,
  input: {
    id?: string;
    branchId: string;
    classroomId: string;
    studentNo: string;
    name: string;
    status?: string;
    studentEmail?: string | null;
    parent?: {
      name: string;
      email: string;
      phone: string;
      relationship?: Relationship;
      kvkkConsent: boolean;
    } | null;
  },
) {
  if (!canManageStudents(actor.role)) throw new Error("Öğrenci yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const branch = await loadBranchInScope(actor, input.branchId);
  const classroom = await prisma.classroom.findUnique({ where: { id: input.classroomId } });
  if (!classroom) throw new Error("Sınıf bulunamadı.");
  assertTenant(actor, classroom.tenantId);
  if (classroom.branchId !== branch.id) throw new Error("Sınıf bu şubeye ait değil.");
  const data = {
    branchId: branch.id,
    classroomId: classroom.id,
    studentNo: requireText(input.studentNo, "Öğrenci no", 2, 32),
    name: requireText(input.name, "Ad soyad", 2, 80),
    status: ["PASSIVE", "GRADUATED"].includes(input.status || "") ? input.status! : "ACTIVE",
  };
  let student;
  if (input.id) {
    const existing = await prisma.student.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Öğrenci bulunamadı.");
    assertTenant(actor, existing.tenantId);
    assertBranch(actor, existing.branchId);
    student = await prisma.student.update({ where: { id: existing.id }, data });
  } else {
    student = await prisma.student.create({ data: { ...data, tenantId } });
  }
  const email = input.studentEmail?.trim().toLowerCase();
  if (email) {
    if (student.userId) {
      await prisma.user.update({
        where: { id: student.userId },
        data: { email, name: student.name, status: student.status === "ACTIVE" ? "ACTIVE" : "PASSIVE" },
      });
    } else {
      const user = await prisma.user.create({
        data: {
          tenantId,
          name: student.name,
          email,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          role: "STUDENT",
          scopes: { create: [{ branchId: branch.id }] },
        },
      });
      student = await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
    }
  }
  if (input.parent?.email && input.parent.phone) {
    await linkParent(actor, {
      studentId: student.id,
      name: input.parent.name,
      email: input.parent.email,
      phone: input.parent.phone,
      relationship: input.parent.relationship,
      kvkkConsent: input.parent.kvkkConsent,
    });
  }
  await writeAudit({
    actor,
    tenantId,
    branchId: branch.id,
    action: input.id ? "STUDENT_UPDATE" : "STUDENT_CREATE",
    entityType: "Student",
    entityId: student.id,
  });
  return student;
}

export async function linkParent(
  actor: Actor,
  input: {
    studentId: string;
    name: string;
    email: string;
    phone: string;
    relationship?: Relationship;
    kvkkConsent: boolean;
  },
) {
  if (!canManageStudents(actor.role)) throw new Error("Veli bağlama yetkiniz yok.");
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new Error("Öğrenci bulunamadı.");
  assertTenant(actor, student.tenantId);
  assertBranch(actor, student.branchId);
  if (!input.kvkkConsent) throw new Error("KVKK açık rızası zorunludur.");
  const email = input.email.trim().toLowerCase();
  const existingParent = await prisma.user.findUnique({ where: { email } });
  if (existingParent?.tenantId && existingParent.tenantId !== student.tenantId) {
    throw new Error("Bu e-posta başka bir firmada kayıtlı.");
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const parent = await prisma.user.upsert({
    where: { email },
    update: {
      name: requireText(input.name, "Veli adı", 2, 80),
      phone: requireText(input.phone, "Veli telefon", 7, 32),
      role: "PARENT",
      tenantId: student.tenantId,
    },
    create: {
      tenantId: student.tenantId,
      name: requireText(input.name, "Veli adı", 2, 80),
      email,
      phone: requireText(input.phone, "Veli telefon", 7, 32),
      passwordHash: hash,
      role: "PARENT",
      scopes: { create: [{ branchId: student.branchId }] },
    },
  });
  const link = await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    update: {
      relationship: input.relationship || "ANNE",
      kvkkConsent: true,
    },
    create: {
      parentId: parent.id,
      studentId: student.id,
      relationship: input.relationship || "ANNE",
      kvkkConsent: true,
    },
  });
  await prisma.notificationPreference.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    update: {},
    create: { parentId: parent.id, studentId: student.id },
  });
  await writeAudit({
    actor,
    tenantId: student.tenantId,
    action: "PARENT_LINK",
    entityType: "ParentStudent",
    entityId: link.id,
    newValue: { email, studentId: student.id },
  });
  return link;
}

export async function unlinkParent(actor: Actor, linkId: string) {
  if (!canManageStudents(actor.role)) throw new Error("Veli çözme yetkiniz yok.");
  const link = await prisma.parentStudent.findUnique({
    where: { id: linkId },
    include: { student: true },
  });
  if (!link) throw new Error("Veli bağı bulunamadı.");
  assertTenant(actor, link.student.tenantId);
  assertBranch(actor, link.student.branchId);
  await prisma.parentStudent.delete({ where: { id: linkId } });
  await writeAudit({
    actor,
    tenantId: link.student.tenantId,
    action: "PARENT_UNLINK",
    entityType: "ParentStudent",
    entityId: linkId,
  });
}
