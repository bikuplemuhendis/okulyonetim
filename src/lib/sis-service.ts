import type {
  AssignmentStatus,
  CalendarEventType,
  ExamType,
  FeePeriod,
  InvoiceStatus,
  MaterialVisibility,
  PaymentMethod,
  Prisma,
  TermStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import type { Actor } from "./types";
import { assertBranch, assertTenant, canEnterGrades, canManageCalendar, canManageFinance, canManageTerms, canViewStaffGrades, requireTenantId } from "./rbac";
import {
  assertPaymentAmount,
  canViewTeacherNote,
  clampScore,
  fivePointFromPercent,
  invoiceBalance,
  invoiceStatusFromBalance,
  letterFromPercent,
  parentOwnsStudent,
  weightedAverage,
  type WeightedItem,
} from "./sis";
import { writeAudit } from "./audit";
import { removeUpload } from "./uploads";

function requireText(value: string, label: string, min: number, max: number) {
  const v = value.trim();
  if (v.length < min || v.length > max) throw new Error(`${label} ${min}-${max} karakter olmalı.`);
  return v;
}

function requirePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} 0'dan büyük olmalı.`);
  return value;
}

async function parentLinks(actor: Actor) {
  return prisma.parentStudent.findMany({ where: { parentId: actor.id } });
}

export async function assertStudentVisible(actor: Actor, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Öğrenci bulunamadı.");
  assertTenant(actor, student.tenantId);
  if (actor.role === "STUDENT") {
    if (actor.studentId !== student.id) throw new Error("Yalnızca kendi kaydınızı görebilirsiniz.");
    return student;
  }
  if (actor.role === "PARENT") {
    const links = await parentLinks(actor);
    if (!parentOwnsStudent(actor.id, links, student.id)) {
      throw new Error("Bu öğrenci size bağlı değil.");
    }
    return student;
  }
  assertBranch(actor, student.branchId);
  return student;
}

export async function teacherTeaches(actor: Actor, classroomId: string, courseId: string) {
  if (actor.role !== "TEACHER") return true;
  const row = await prisma.lessonSchedule.findFirst({
    where: { teacherId: actor.id, classroomId, courseId },
  });
  return Boolean(row);
}

export async function assertTeacherTeaches(actor: Actor, classroomId: string, courseId: string) {
  if (["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER"].includes(actor.role)) {
    return;
  }
  if (actor.role !== "TEACHER") throw new Error("Bu işlem için not yetkiniz yok.");
  const ok = await teacherTeaches(actor, classroomId, courseId);
  if (!ok) throw new Error("Bu sınıf/ders sizin programınızda değil.");
}

export async function teacherClassroomIds(actor: Actor) {
  if (actor.role !== "TEACHER") return [];
  const rows = await prisma.lessonSchedule.findMany({
    where: { teacherId: actor.id, tenantId: actor.tenantId ?? undefined },
    select: { classroomId: true },
    distinct: ["classroomId"],
  });
  return rows.map((r) => r.classroomId);
}

export async function currentTerm(tenantId: string) {
  return (
    (await prisma.academicTerm.findFirst({ where: { tenantId, isCurrent: true } })) ??
    (await prisma.academicTerm.findFirst({ where: { tenantId }, orderBy: { startDate: "desc" } }))
  );
}

export async function upsertTerm(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    startDate: string;
    endDate: string;
    status?: TermStatus;
    isCurrent?: boolean;
  },
) {
  if (!canManageTerms(actor.role)) throw new Error("Dönem yönetimi yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (!(startDate < endDate)) throw new Error("Dönem başlangıcı bitişten önce olmalı.");
  const name = requireText(input.name, "Dönem adı", 2, 80);
  const status = input.status || "PLANNED";
  if (input.id) {
    const existing = await prisma.academicTerm.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Dönem bulunamadı.");
    assertTenant(actor, existing.tenantId);
    const row = await prisma.academicTerm.update({
      where: { id: existing.id },
      data: { name, startDate, endDate, status },
    });
    if (input.isCurrent) await setCurrentTerm(actor, row.id);
    await writeAudit({ actor, tenantId, action: "TERM_UPDATE", entityType: "AcademicTerm", entityId: row.id });
    return row;
  }
  const row = await prisma.academicTerm.create({
    data: { tenantId, name, startDate, endDate, status, isCurrent: false },
  });
  if (input.isCurrent) await setCurrentTerm(actor, row.id);
  await writeAudit({ actor, tenantId, action: "TERM_CREATE", entityType: "AcademicTerm", entityId: row.id });
  return row;
}

export async function setCurrentTerm(actor: Actor, id: string) {
  if (!canManageTerms(actor.role)) throw new Error("Dönem yönetimi yetkiniz yok.");
  const existing = await prisma.academicTerm.findUnique({ where: { id } });
  if (!existing) throw new Error("Dönem bulunamadı.");
  assertTenant(actor, existing.tenantId);
  await prisma.$transaction([
    prisma.academicTerm.updateMany({ where: { tenantId: existing.tenantId }, data: { isCurrent: false } }),
    prisma.academicTerm.update({ where: { id }, data: { isCurrent: true, status: "ACTIVE" } }),
  ]);
  await writeAudit({ actor, tenantId: existing.tenantId, action: "TERM_CURRENT", entityType: "AcademicTerm", entityId: id });
}

export async function deleteTerm(actor: Actor, id: string) {
  if (!canManageTerms(actor.role)) throw new Error("Dönem silme yetkiniz yok.");
  const existing = await prisma.academicTerm.findUnique({ where: { id } });
  if (!existing) throw new Error("Dönem bulunamadı.");
  assertTenant(actor, existing.tenantId);
  const exams = await prisma.exam.count({ where: { termId: id } });
  if (exams > 0) throw new Error("Sınavı olan dönem silinemez.");
  await prisma.academicTerm.delete({ where: { id } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "TERM_DELETE", entityType: "AcademicTerm", entityId: id });
}

export async function upsertCalendarEvent(
  actor: Actor,
  input: {
    id?: string;
    branchId?: string | null;
    termId?: string | null;
    title: string;
    body: string;
    startsAt: string;
    endsAt: string;
    allDay?: boolean;
    type?: CalendarEventType;
    audience?: string[];
  },
) {
  if (!canManageCalendar(actor.role)) throw new Error("Takvim yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  if (input.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw new Error("Şube bulunamadı.");
    assertTenant(actor, branch.tenantId);
    assertBranch(actor, branch.id);
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!(startsAt <= endsAt)) throw new Error("Başlangıç bitişten sonra olamaz.");
  const data = {
    branchId: input.branchId || null,
    termId: input.termId || null,
    title: requireText(input.title, "Başlık", 2, 120),
    body: requireText(input.body, "Açıklama", 2, 4000),
    startsAt,
    endsAt,
    allDay: input.allDay !== false,
    type: input.type || "OTHER",
    audience: JSON.stringify(input.audience?.length ? input.audience : ["PARENT", "STUDENT", "TEACHER"]),
  };
  if (input.id) {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Etkinlik bulunamadı.");
    assertTenant(actor, existing.tenantId);
    const row = await prisma.calendarEvent.update({ where: { id: existing.id }, data });
    await writeAudit({ actor, tenantId, action: "CALENDAR_UPDATE", entityType: "CalendarEvent", entityId: row.id });
    return row;
  }
  const row = await prisma.calendarEvent.create({ data: { ...data, tenantId, authorId: actor.id } });
  await writeAudit({ actor, tenantId, action: "CALENDAR_CREATE", entityType: "CalendarEvent", entityId: row.id });
  return row;
}

export async function deleteCalendarEvent(actor: Actor, id: string) {
  if (!canManageCalendar(actor.role)) throw new Error("Takvim silme yetkiniz yok.");
  const existing = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!existing) throw new Error("Etkinlik bulunamadı.");
  assertTenant(actor, existing.tenantId);
  await prisma.calendarEvent.delete({ where: { id } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "CALENDAR_DELETE", entityType: "CalendarEvent", entityId: id });
}

export async function upsertExam(
  actor: Actor,
  input: {
    id?: string;
    termId: string;
    branchId: string;
    courseId: string;
    classroomId?: string | null;
    teacherId?: string;
    name: string;
    examDate: string;
    examType?: ExamType;
    maxScore?: number;
    weight?: number;
    published?: boolean;
  },
) {
  if (!canEnterGrades(actor.role)) throw new Error("Sınav yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const term = await prisma.academicTerm.findUnique({ where: { id: input.termId } });
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!term || !course || !branch) throw new Error("Dönem/ders/şube bulunamadı.");
  assertTenant(actor, term.tenantId);
  assertTenant(actor, course.tenantId);
  assertTenant(actor, branch.tenantId);
  assertBranch(actor, branch.id);
  let classroomId = input.classroomId || null;
  if (classroomId) {
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) throw new Error("Sınıf bulunamadı.");
    if (classroom.branchId !== branch.id) throw new Error("Sınıf bu şubeye ait değil.");
    await assertTeacherTeaches(actor, classroom.id, course.id);
  } else if (actor.role === "TEACHER") {
    const taught = await prisma.lessonSchedule.findFirst({
      where: { teacherId: actor.id, courseId: course.id, branchId: branch.id },
    });
    if (!taught) throw new Error("Bu ders sizin programınızda değil.");
    classroomId = taught.classroomId;
    await assertTeacherTeaches(actor, classroomId, course.id);
  }
  const teacherId = actor.role === "TEACHER" ? actor.id : input.teacherId || actor.id;
  const data = {
    termId: term.id,
    branchId: branch.id,
    courseId: course.id,
    classroomId,
    teacherId,
    name: requireText(input.name, "Sınav adı", 2, 120),
    examDate: new Date(input.examDate),
    examType: input.examType || "WRITTEN",
    maxScore: requirePositive(input.maxScore ?? 100, "Tam puan"),
    weight: requirePositive(input.weight ?? 1, "Ağırlık"),
    published: Boolean(input.published),
  };
  if (input.id) {
    const existing = await prisma.exam.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Sınav bulunamadı.");
    assertTenant(actor, existing.tenantId);
    if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu sınav size ait değil.");
    const row = await prisma.exam.update({ where: { id: existing.id }, data });
    await writeAudit({ actor, tenantId, action: "EXAM_UPDATE", entityType: "Exam", entityId: row.id });
    return row;
  }
  const row = await prisma.exam.create({ data: { ...data, tenantId, createdById: actor.id } });
  await writeAudit({ actor, tenantId, action: "EXAM_CREATE", entityType: "Exam", entityId: row.id });
  return row;
}

export async function deleteExam(actor: Actor, id: string) {
  if (!canEnterGrades(actor.role)) throw new Error("Sınav silme yetkiniz yok.");
  const existing = await prisma.exam.findUnique({ where: { id } });
  if (!existing) throw new Error("Sınav bulunamadı.");
  assertTenant(actor, existing.tenantId);
  if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu sınav size ait değil.");
  await prisma.exam.delete({ where: { id } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "EXAM_DELETE", entityType: "Exam", entityId: id });
}

export async function setExamPublished(actor: Actor, examId: string, published: boolean) {
  if (!canEnterGrades(actor.role)) throw new Error("Sınav yayın yetkiniz yok.");
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new Error("Sınav bulunamadı.");
  assertTenant(actor, exam.tenantId);
  if (actor.role === "TEACHER" && exam.teacherId !== actor.id) throw new Error("Bu sınav size ait değil.");
  return prisma.exam.update({ where: { id: examId }, data: { published } });
}

export async function upsertExamScore(
  actor: Actor,
  input: { examId: string; studentId: string; score: number; note?: string | null },
) {
  if (!canEnterGrades(actor.role)) throw new Error("Not girişi yetkiniz yok.");
  const exam = await prisma.exam.findUnique({ where: { id: input.examId } });
  if (!exam) throw new Error("Sınav bulunamadı.");
  assertTenant(actor, exam.tenantId);
  if (actor.role === "TEACHER" && exam.teacherId !== actor.id) throw new Error("Bu sınav size ait değil.");
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new Error("Öğrenci bulunamadı.");
  assertTenant(actor, student.tenantId);
  if (exam.classroomId && student.classroomId !== exam.classroomId) {
    throw new Error("Öğrenci bu sınavın sınıfında değil.");
  }
  if (student.branchId !== exam.branchId) throw new Error("Öğrenci bu şubede değil.");
  const score = clampScore(input.score, exam.maxScore);
  const row = await prisma.examScore.upsert({
    where: { examId_studentId: { examId: exam.id, studentId: student.id } },
    update: { score, note: input.note?.trim() || null },
    create: {
      tenantId: exam.tenantId,
      examId: exam.id,
      studentId: student.id,
      score,
      note: input.note?.trim() || null,
    },
  });
  await writeAudit({
    actor,
    tenantId: exam.tenantId,
    action: "EXAM_SCORE",
    entityType: "ExamScore",
    entityId: row.id,
    newValue: { studentId: student.id, score },
  });
  return row;
}

export async function upsertAssignment(
  actor: Actor,
  input: {
    id?: string;
    termId?: string | null;
    branchId: string;
    courseId: string;
    classroomId: string;
    teacherId?: string;
    title: string;
    body: string;
    dueAt: string;
    maxScore?: number;
    weight?: number;
    published?: boolean;
    status?: AssignmentStatus;
  },
) {
  if (!canEnterGrades(actor.role)) throw new Error("Ödev yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const classroom = await prisma.classroom.findUnique({ where: { id: input.classroomId } });
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!classroom || !course) throw new Error("Sınıf veya ders bulunamadı.");
  assertTenant(actor, classroom.tenantId);
  assertBranch(actor, classroom.branchId);
  await assertTeacherTeaches(actor, classroom.id, course.id);
  const data = {
    termId: input.termId || null,
    branchId: classroom.branchId,
    courseId: course.id,
    classroomId: classroom.id,
    teacherId: actor.role === "TEACHER" ? actor.id : input.teacherId || actor.id,
    title: requireText(input.title, "Ödev başlığı", 2, 160),
    body: requireText(input.body, "Ödev metni", 2, 8000),
    dueAt: new Date(input.dueAt),
    maxScore: requirePositive(input.maxScore ?? 100, "Tam puan"),
    weight: requirePositive(input.weight ?? 1, "Ağırlık"),
    published: input.published !== false,
    status: input.status || "PUBLISHED",
  };
  if (input.id) {
    const existing = await prisma.assignment.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Ödev bulunamadı.");
    assertTenant(actor, existing.tenantId);
    if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu ödev size ait değil.");
    const row = await prisma.assignment.update({ where: { id: existing.id }, data });
    await writeAudit({ actor, tenantId, action: "ASSIGNMENT_UPDATE", entityType: "Assignment", entityId: row.id });
    return row;
  }
  const row = await prisma.assignment.create({ data: { ...data, tenantId } });
  await writeAudit({ actor, tenantId, action: "ASSIGNMENT_CREATE", entityType: "Assignment", entityId: row.id });
  return row;
}

export async function deleteAssignment(actor: Actor, id: string) {
  if (!canEnterGrades(actor.role)) throw new Error("Ödev silme yetkiniz yok.");
  const existing = await prisma.assignment.findUnique({ where: { id }, include: { submissions: true } });
  if (!existing) throw new Error("Ödev bulunamadı.");
  assertTenant(actor, existing.tenantId);
  if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu ödev size ait değil.");
  for (const s of existing.submissions) await removeUpload(s.storedName);
  await prisma.assignment.delete({ where: { id } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "ASSIGNMENT_DELETE", entityType: "Assignment", entityId: id });
}

export async function submitAssignment(
  actor: Actor,
  input: {
    assignmentId: string;
    body?: string;
    file?: { fileName: string; storedName: string; mimeType: string } | null;
  },
) {
  if (actor.role !== "STUDENT" || !actor.studentId) throw new Error("Ödevi öğrenci teslim eder.");
  const assignment = await prisma.assignment.findUnique({ where: { id: input.assignmentId } });
  if (!assignment) throw new Error("Ödev bulunamadı.");
  assertTenant(actor, assignment.tenantId);
  const student = await prisma.student.findUnique({ where: { id: actor.studentId } });
  if (!student || student.classroomId !== assignment.classroomId) {
    throw new Error("Bu ödev sizin sınıfınıza ait değil.");
  }
  if (!assignment.published || assignment.status === "CLOSED") throw new Error("Ödev teslime kapalı.");
  const late = new Date() > assignment.dueAt;
  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
  });
  if (existing?.status === "GRADED") throw new Error("Notlanmış teslim değiştirilemez.");
  if (input.file && existing?.storedName) await removeUpload(existing.storedName);
  const row = await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
    update: {
      body: input.body?.trim() || existing?.body || null,
      fileName: input.file?.fileName ?? existing?.fileName,
      storedName: input.file?.storedName ?? existing?.storedName,
      mimeType: input.file?.mimeType ?? existing?.mimeType,
      submittedAt: new Date(),
      status: late ? "LATE" : "SUBMITTED",
    },
    create: {
      tenantId: assignment.tenantId,
      assignmentId: assignment.id,
      studentId: student.id,
      body: input.body?.trim() || null,
      fileName: input.file?.fileName,
      storedName: input.file?.storedName,
      mimeType: input.file?.mimeType,
      submittedAt: new Date(),
      status: late ? "LATE" : "SUBMITTED",
    },
  });
  return row;
}

export async function gradeSubmission(
  actor: Actor,
  input: { submissionId: string; score: number; feedback?: string | null },
) {
  if (!canEnterGrades(actor.role)) throw new Error("Ödev notu yetkiniz yok.");
  const sub = await prisma.assignmentSubmission.findUnique({
    where: { id: input.submissionId },
    include: { assignment: true },
  });
  if (!sub) throw new Error("Teslim bulunamadı.");
  assertTenant(actor, sub.tenantId);
  if (actor.role === "TEACHER" && sub.assignment.teacherId !== actor.id) {
    throw new Error("Bu ödev size ait değil.");
  }
  const score = clampScore(input.score, sub.assignment.maxScore);
  return prisma.assignmentSubmission.update({
    where: { id: sub.id },
    data: { score, feedback: input.feedback?.trim() || null, status: "GRADED" },
  });
}

export async function createMaterial(
  actor: Actor,
  input: {
    title: string;
    description: string;
    visibility: MaterialVisibility;
    branchId?: string | null;
    courseId?: string | null;
    classroomId?: string | null;
    file: { fileName: string; storedName: string; mimeType: string; sizeBytes: number };
  },
) {
  if (!canEnterGrades(actor.role) && actor.role !== "BRANCH_OPS") throw new Error("Materyal yükleme yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  if (input.classroomId && input.courseId) {
    await assertTeacherTeaches(actor, input.classroomId, input.courseId);
  }
  if (input.branchId) assertBranch(actor, input.branchId);
  const row = await prisma.material.create({
    data: {
      tenantId,
      teacherId: actor.id,
      branchId: input.branchId || null,
      courseId: input.courseId || null,
      classroomId: input.classroomId || null,
      title: requireText(input.title, "Başlık", 2, 160),
      description: input.description.trim(),
      visibility: input.visibility,
      fileName: input.file.fileName,
      storedName: input.file.storedName,
      mimeType: input.file.mimeType,
      sizeBytes: input.file.sizeBytes,
    },
  });
  await writeAudit({ actor, tenantId, action: "MATERIAL_CREATE", entityType: "Material", entityId: row.id });
  return row;
}

export async function updateMaterial(
  actor: Actor,
  input: {
    id: string;
    title: string;
    description: string;
    visibility: MaterialVisibility;
    branchId?: string | null;
    courseId?: string | null;
    classroomId?: string | null;
  },
) {
  const existing = await prisma.material.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Materyal bulunamadı.");
  assertTenant(actor, existing.tenantId);
  if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu materyal size ait değil.");
  const row = await prisma.material.update({
    where: { id: existing.id },
    data: {
      title: requireText(input.title, "Başlık", 2, 160),
      description: input.description.trim(),
      visibility: input.visibility,
      branchId: input.branchId || null,
      courseId: input.courseId || null,
      classroomId: input.classroomId || null,
    },
  });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "MATERIAL_UPDATE", entityType: "Material", entityId: row.id });
  return row;
}

export async function deleteMaterial(actor: Actor, id: string) {
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) throw new Error("Materyal bulunamadı.");
  assertTenant(actor, existing.tenantId);
  if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu materyal size ait değil.");
  await removeUpload(existing.storedName);
  await prisma.material.delete({ where: { id } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "MATERIAL_DELETE", entityType: "Material", entityId: id });
}

export async function canAccessMaterial(actor: Actor, materialId: string) {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return null;
  try {
    assertTenant(actor, material.tenantId);
  } catch {
    return null;
  }
  if (material.teacherId === actor.id) return material;
  if (["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER", "BRANCH_OPS"].includes(actor.role)) {
    if (material.branchId) {
      try {
        assertBranch(actor, material.branchId);
      } catch {
        return null;
      }
    }
    return material;
  }
  if (material.visibility === "PRIVATE") return null;

  let studentIds: string[] = [];
  if (actor.role === "STUDENT" && actor.studentId) studentIds = [actor.studentId];
  if (actor.role === "PARENT") {
    studentIds = (await parentLinks(actor)).map((l) => l.studentId);
  }
  if (!studentIds.length) return null;
  const students = await prisma.student.findMany({ where: { id: { in: studentIds } } });
  const ok = students.some((s) => {
    if (material.visibility === "BRANCH") return !material.branchId || s.branchId === material.branchId;
    if (material.visibility === "CLASS") return material.classroomId === s.classroomId;
    if (material.visibility === "COURSE") return true;
    return false;
  });
  if (!ok) return null;
  if (material.visibility === "COURSE" && material.courseId) {
    const classIds = students.map((s) => s.classroomId);
    const taught = await prisma.lessonSchedule.findFirst({
      where: { courseId: material.courseId, classroomId: { in: classIds } },
    });
    if (!taught) return null;
  }
  return material;
}

export async function upsertFeeType(
  actor: Actor,
  input: { id?: string; name: string; amount: number; period?: FeePeriod; description?: string | null; status?: string },
) {
  if (!canManageFinance(actor.role)) throw new Error("Ücret tanımı yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  const data = {
    name: requireText(input.name, "Ücret adı", 2, 80),
    amount: requirePositive(input.amount, "Tutar"),
    period: input.period || "TERM",
    description: input.description?.trim() || null,
    status: input.status === "PASSIVE" ? "PASSIVE" : "ACTIVE",
  };
  if (input.id) {
    const existing = await prisma.feeType.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Ücret türü bulunamadı.");
    assertTenant(actor, existing.tenantId);
    return prisma.feeType.update({ where: { id: existing.id }, data });
  }
  return prisma.feeType.create({ data: { ...data, tenantId } });
}

export async function deleteFeeType(actor: Actor, id: string) {
  if (!canManageFinance(actor.role)) throw new Error("Ücret silme yetkiniz yok.");
  const existing = await prisma.feeType.findUnique({ where: { id } });
  if (!existing) throw new Error("Ücret türü bulunamadı.");
  assertTenant(actor, existing.tenantId);
  const used = await prisma.invoice.count({ where: { feeTypeId: id } });
  if (used > 0) throw new Error("Faturası olan ücret türü silinemez.");
  await prisma.feeType.delete({ where: { id } });
}

export async function upsertInvoice(
  actor: Actor,
  input: {
    id?: string;
    studentId: string;
    feeTypeId?: string | null;
    title: string;
    amount: number;
    dueDate: string;
    note?: string | null;
  },
) {
  if (!canManageFinance(actor.role)) throw new Error("Fatura yetkiniz yok.");
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new Error("Öğrenci bulunamadı.");
  assertTenant(actor, student.tenantId);
  assertBranch(actor, student.branchId);
  const data = {
    studentId: student.id,
    branchId: student.branchId,
    feeTypeId: input.feeTypeId || null,
    title: requireText(input.title, "Fatura başlığı", 2, 160),
    amount: requirePositive(input.amount, "Tutar"),
    dueDate: new Date(input.dueDate),
    note: input.note?.trim() || null,
  };
  if (input.id) {
    const existing = await prisma.invoice.findUnique({ where: { id: input.id }, include: { payments: true } });
    if (!existing) throw new Error("Fatura bulunamadı.");
    assertTenant(actor, existing.tenantId);
    if (existing.status === "CANCELLED") {
      throw new Error("İptal fatura düzenlenemez.");
    }
    const row = await prisma.invoice.update({ where: { id: existing.id }, data });
    return refreshInvoiceStatus(row.id);
  }
  const row = await prisma.invoice.create({ data: { ...data, tenantId: student.tenantId } });
  await writeAudit({ actor, tenantId: student.tenantId, action: "INVOICE_CREATE", entityType: "Invoice", entityId: row.id });
  return row;
}

async function refreshInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) throw new Error("Fatura bulunamadı.");
  if (invoice.status === "CANCELLED") return invoice;
  const status = invoiceStatusFromBalance(invoice.amount, invoice.payments, false);
  if (status !== invoice.status) {
    return prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
  return invoice;
}

export async function cancelInvoice(actor: Actor, id: string) {
  if (!canManageFinance(actor.role)) throw new Error("Fatura iptal yetkiniz yok.");
  const existing = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!existing) throw new Error("Fatura bulunamadı.");
  assertTenant(actor, existing.tenantId);
  assertBranch(actor, existing.branchId);
  if (existing.payments.length) throw new Error("Tahsilatı olan fatura iptal edilemez. Önce tahsilatı silin.");
  const row = await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  await writeAudit({ actor, tenantId: existing.tenantId, action: "INVOICE_CANCEL", entityType: "Invoice", entityId: id });
  return row;
}

export async function recordPayment(
  actor: Actor,
  input: { invoiceId: string; amount: number; method?: PaymentMethod; note?: string | null; paidAt?: string },
) {
  if (!canManageFinance(actor.role)) throw new Error("Tahsilat yetkiniz yok.");
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, include: { payments: true } });
  if (!invoice) throw new Error("Fatura bulunamadı.");
  assertTenant(actor, invoice.tenantId);
  assertBranch(actor, invoice.branchId);
  if (invoice.status === "CANCELLED") throw new Error("İptal faturaya tahsilat yazılamaz.");
  const remaining = invoiceBalance(invoice.amount, invoice.payments);
  const amount = Math.round(input.amount * 100) / 100;
  assertPaymentAmount(amount, remaining);
  const payment = await prisma.payment.create({
    data: {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      amount,
      method: input.method || "CASH",
      note: input.note?.trim() || null,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      recordedById: actor.id,
    },
  });
  await refreshInvoiceStatus(invoice.id);
  await writeAudit({
    actor,
    tenantId: invoice.tenantId,
    action: "PAYMENT_CREATE",
    entityType: "Payment",
    entityId: payment.id,
    newValue: { amount, invoiceId: invoice.id },
  });
  return payment;
}

export async function deletePayment(actor: Actor, id: string) {
  if (!canManageFinance(actor.role)) throw new Error("Tahsilat silme yetkiniz yok.");
  const existing = await prisma.payment.findUnique({ where: { id }, include: { invoice: true } });
  if (!existing) throw new Error("Tahsilat bulunamadı.");
  assertTenant(actor, existing.tenantId);
  await prisma.payment.delete({ where: { id } });
  await refreshInvoiceStatus(existing.invoiceId);
  await writeAudit({ actor, tenantId: existing.tenantId, action: "PAYMENT_DELETE", entityType: "Payment", entityId: id });
}

export function studentBalance(invoices: { amount: number; status: InvoiceStatus; payments: { amount: number }[] }[]) {
  return invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((acc, i) => acc + invoiceBalance(i.amount, i.payments), 0);
}

export async function upsertTeacherNote(actor: Actor, input: { id?: string; studentId: string; body: string }) {
  if (actor.role !== "TEACHER" && !["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "BRANCH_MANAGER"].includes(actor.role)) {
    throw new Error("Öğretmen notu yetkiniz yok.");
  }
  const student = await assertStudentVisible(actor, input.studentId);
  if (actor.role === "TEACHER") {
    const ids = await teacherClassroomIds(actor);
    if (!ids.includes(student.classroomId)) throw new Error("Bu öğrenci sizin sınıfınızda değil.");
  }
  const body = requireText(input.body, "Not", 2, 4000);
  if (input.id) {
    const existing = await prisma.teacherNote.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Not bulunamadı.");
    if (!canViewTeacherNote({ actorId: actor.id, actorRole: actor.role, noteTeacherId: existing.teacherId })) {
      throw new Error("Bu not size ait değil.");
    }
    if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu not size ait değil.");
    return prisma.teacherNote.update({ where: { id: existing.id }, data: { body } });
  }
  return prisma.teacherNote.create({
    data: { tenantId: student.tenantId, teacherId: actor.id, studentId: student.id, body },
  });
}

export async function deleteTeacherNote(actor: Actor, id: string) {
  const existing = await prisma.teacherNote.findUnique({ where: { id } });
  if (!existing) throw new Error("Not bulunamadı.");
  assertTenant(actor, existing.tenantId);
  if (actor.role === "TEACHER" && existing.teacherId !== actor.id) throw new Error("Bu not size ait değil.");
  if (!canViewTeacherNote({ actorId: actor.id, actorRole: actor.role, noteTeacherId: existing.teacherId })) {
    throw new Error("Bu notu silemezsiniz.");
  }
  await prisma.teacherNote.delete({ where: { id } });
}

export async function listTeacherNotes(actor: Actor, studentId?: string) {
  const where: Prisma.TeacherNoteWhereInput = { tenantId: requireTenantId(actor) };
  if (studentId) {
    await assertStudentVisible(actor, studentId);
    where.studentId = studentId;
  }
  if (actor.role === "TEACHER") where.teacherId = actor.id;
  const rows = await prisma.teacherNote.findMany({
    where,
    include: { student: true, teacher: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.filter((n) =>
    canViewTeacherNote({ actorId: actor.id, actorRole: actor.role, noteTeacherId: n.teacherId }),
  );
}

export async function courseGradeItems(opts: { studentId: string; courseId: string; termId: string; publishedOnly: boolean }) {
  const exams = await prisma.exam.findMany({
    where: {
      termId: opts.termId,
      courseId: opts.courseId,
      published: opts.publishedOnly ? true : undefined,
      scores: { some: { studentId: opts.studentId } },
    },
    include: { scores: { where: { studentId: opts.studentId } } },
  });
  const assignments = await prisma.assignment.findMany({
    where: {
      termId: opts.termId,
      courseId: opts.courseId,
      published: opts.publishedOnly ? true : undefined,
      submissions: { some: { studentId: opts.studentId, score: { not: null } } },
    },
    include: { submissions: { where: { studentId: opts.studentId } } },
  });
  const items: WeightedItem[] = [];
  for (const e of exams) {
    const sc = e.scores[0];
    if (sc) items.push({ score: sc.score, maxScore: e.maxScore, weight: e.weight });
  }
  for (const a of assignments) {
    const sub = a.submissions[0];
    if (sub?.score != null) items.push({ score: sub.score, maxScore: a.maxScore, weight: a.weight });
  }
  return items;
}

export async function studentCourseAverage(opts: {
  studentId: string;
  courseId: string;
  termId: string;
  publishedOnly: boolean;
}) {
  const items = await courseGradeItems(opts);
  return weightedAverage(items);
}

export async function generateReportCards(actor: Actor, termId: string, classroomId?: string) {
  if (!canViewStaffGrades(actor.role)) throw new Error("Karne yetkiniz yok.");
  if (!canEnterGrades(actor.role) && actor.role !== "BRANCH_OPS") throw new Error("Karne üretme yetkiniz yok.");
  const term = await prisma.academicTerm.findUnique({ where: { id: termId } });
  if (!term) throw new Error("Dönem bulunamadı.");
  assertTenant(actor, term.tenantId);
  const students = await prisma.student.findMany({
    where: {
      tenantId: term.tenantId,
      status: "ACTIVE",
      ...(classroomId ? { classroomId } : {}),
      ...(!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)
        ? { branchId: { in: actor.branchIds } }
        : {}),
    },
    include: { classroom: { include: { schedules: { include: { course: true } } } } },
  });
  if (actor.role === "TEACHER") {
    const ids = await teacherClassroomIds(actor);
    if (classroomId && !ids.includes(classroomId)) throw new Error("Bu sınıf sizin değil.");
  }
  const cards = [];
  for (const student of students) {
    if (actor.role === "TEACHER") {
      const ids = await teacherClassroomIds(actor);
      if (!ids.includes(student.classroomId)) continue;
    }
    const courseIds = [...new Set(student.classroom.schedules.map((s) => s.courseId))];
    const lines = [];
    for (const courseId of courseIds) {
      const average = await studentCourseAverage({
        studentId: student.id,
        courseId,
        termId: term.id,
        publishedOnly: false,
      });
      if (average == null) continue;
      lines.push({
        courseId,
        average,
        letter: letterFromPercent(average),
        fivePoint: fivePointFromPercent(average),
      });
    }
    const card = await prisma.reportCard.upsert({
      where: { termId_studentId: { termId: term.id, studentId: student.id } },
      update: { generatedAt: new Date(), published: false },
      create: { tenantId: term.tenantId, termId: term.id, studentId: student.id, published: false },
    });
    await prisma.reportCardLine.deleteMany({ where: { reportCardId: card.id } });
    if (lines.length) {
      await prisma.reportCardLine.createMany({
        data: lines.map((l) => ({ ...l, reportCardId: card.id })),
      });
    }
    cards.push(card);
  }
  await writeAudit({
    actor,
    tenantId: term.tenantId,
    action: "REPORT_GENERATE",
    entityType: "ReportCard",
    newValue: { termId, count: cards.length },
  });
  return cards;
}

export async function publishReportCard(actor: Actor, id: string, published: boolean) {
  if (!canEnterGrades(actor.role) && actor.role !== "BRANCH_OPS") throw new Error("Karne yayın yetkiniz yok.");
  const card = await prisma.reportCard.findUnique({ where: { id } });
  if (!card) throw new Error("Karne bulunamadı.");
  assertTenant(actor, card.tenantId);
  const row = await prisma.reportCard.update({ where: { id }, data: { published } });
  await writeAudit({
    actor,
    tenantId: card.tenantId,
    action: published ? "REPORT_PUBLISH" : "REPORT_UNPUBLISH",
    entityType: "ReportCard",
    entityId: id,
  });
  return row;
}

export async function parentStudents(actor: Actor) {
  if (actor.role !== "PARENT") return [];
  return prisma.parentStudent.findMany({
    where: { parentId: actor.id },
    include: { student: { include: { classroom: true, branch: true } } },
    orderBy: { student: { name: "asc" } },
  });
}

export async function requireOwnStudent(actor: Actor) {
  if (actor.role !== "STUDENT" || !actor.studentId) throw new Error("Öğrenci hesabı gerekli.");
  const student = await prisma.student.findUnique({
    where: { id: actor.studentId },
    include: { classroom: true, branch: true },
  });
  if (!student) throw new Error("Öğrenci kaydı yok.");
  return student;
}

export async function visibleAnnouncements(actor: Actor) {
  const tenantId = actor.tenantId;
  if (!tenantId) return [];
  const items = await prisma.announcement.findMany({
    where: { tenantId },
    include: { author: true, branch: true },
    orderBy: { createdAt: "desc" },
  });
  if (["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)) return items;
  return items.filter((a) => {
    if (a.branchId && actor.role !== "PARENT" && actor.role !== "STUDENT") {
      if (actor.branchIds.length && !actor.branchIds.includes(a.branchId)) return false;
    }
    try {
      const audience = JSON.parse(a.audience) as string[];
      if (Array.isArray(audience) && audience.length && ["PARENT", "STUDENT", "TEACHER"].includes(actor.role)) {
        return audience.includes(actor.role);
      }
    } catch {
      return true;
    }
    return true;
  });
}

export async function upsertAnnouncement(
  actor: Actor,
  input: { id?: string; title: string; body: string; branchId?: string | null; audience: string[] },
) {
  if (["PARENT", "STUDENT"].includes(actor.role)) throw new Error("Duyuru yetkiniz yok.");
  const tenantId = requireTenantId(actor);
  if (input.branchId) assertBranch(actor, input.branchId);
  const data = {
    title: requireText(input.title, "Başlık", 2, 160),
    body: requireText(input.body, "Metin", 2, 8000),
    branchId: input.branchId || null,
    audience: JSON.stringify(input.audience.length ? input.audience : ["PARENT", "STUDENT", "TEACHER"]),
  };
  if (input.id) {
    const existing = await prisma.announcement.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Duyuru bulunamadı.");
    assertTenant(actor, existing.tenantId);
    return prisma.announcement.update({ where: { id: existing.id }, data });
  }
  return prisma.announcement.create({ data: { ...data, tenantId, authorId: actor.id } });
}

export async function deleteAnnouncement(actor: Actor, id: string) {
  if (["PARENT", "STUDENT"].includes(actor.role)) throw new Error("Duyuru silme yetkiniz yok.");
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new Error("Duyuru bulunamadı.");
  assertTenant(actor, existing.tenantId);
  await prisma.announcement.delete({ where: { id } });
}
