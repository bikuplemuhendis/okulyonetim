import type {
  AbsenceKind,
  AssessmentKind,
  BehaviorKind,
  FeeStatus,
  HomeworkStatus,
  LeadStatus,
  LoanStatus,
  MeetingStatus,
  Role,
  TutoringStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import type { Actor } from "./types";
import { assertBranch, assertTenant, canManageOrg, requireTenantId, tenantFilter } from "./rbac";
import { writeAudit } from "./audit";

export function weightedAverage(entries: { score: number; maxScore: number; weight: number }[]): number | null {
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (!entries.length || totalWeight <= 0) return null;
  const acc = entries.reduce((s, e) => s + (e.score / e.maxScore) * 100 * e.weight, 0);
  return Math.round((acc / totalWeight) * 10) / 10;
}

export function feeStatus(amount: number, paid: number, dueDate: string, today: string): FeeStatus {
  if (paid >= amount) return "PAID";
  if (paid > 0) return dueDate < today ? "OVERDUE" : "PARTIAL";
  return dueDate < today ? "OVERDUE" : "OPEN";
}

export function remainingFee(amount: number, paid: number): number {
  return Math.max(0, Math.round((amount - paid) * 100) / 100);
}

export function homeworkStatus(dueDate: string, submittedAt: Date | null, today: string): HomeworkStatus {
  if (submittedAt) return "SUBMITTED";
  return dueDate < today ? "LATE" : "ASSIGNED";
}

export function behaviorBalance(points: number[]): number {
  return points.reduce((s, p) => s + p, 0);
}

export function canUseSisWrite(role: Role) {
  return canManageOrg(role) || role === "TEACHER" || role === "COUNSELOR" || role === "BRANCH_OPS";
}

export function canSeeFinance(role: Role) {
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER", "BRANCH_OPS"].includes(role);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function scoped(actor: Actor) {
  const tenantId = requireTenantId(actor);
  return { tenantId, filter: tenantFilter(actor) };
}

export async function createAssessment(
  actor: Actor,
  input: {
    branchId: string;
    courseId: string;
    title: string;
    kind: AssessmentKind;
    examDate: string;
    maxScore: number;
    weight: number;
    countsForReport: boolean;
  },
) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  const row = await prisma.assessment.create({ data: { tenantId, ...input } });
  await writeAudit({ actor, action: "ASSESSMENT_CREATE", entityType: "Assessment", entityId: row.id });
  return row;
}

export async function upsertGrade(actor: Actor, assessmentId: string, studentId: string, score: number, comment?: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw new Error("Sınav bulunamadı");
  assertTenant(actor, assessment.tenantId);
  assertBranch(actor, assessment.branchId);
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.tenantId !== assessment.tenantId) throw new Error("Öğrenci bulunamadı");
  if (score < 0 || score > assessment.maxScore) throw new Error("Puan aralık dışında");
  return prisma.gradeEntry.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    create: {
      tenantId: assessment.tenantId,
      assessmentId,
      studentId,
      classroomId: student.classroomId,
      score,
      comment,
    },
    update: { score, comment },
  });
}

export async function createHomework(
  actor: Actor,
  input: {
    branchId: string;
    courseId: string;
    classroomId: string;
    title: string;
    instructions: string;
    dueDate: string;
    kind: string;
  },
) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  const hw = await prisma.homework.create({ data: { tenantId, teacherId: actor.id, ...input } });
  const students = await prisma.student.findMany({ where: { classroomId: input.classroomId, status: "ACTIVE" } });
  if (students.length) {
    await prisma.homeworkSubmission.createMany({
      data: students.map((s) => ({ homeworkId: hw.id, studentId: s.id, status: "ASSIGNED" as const })),
    });
  }
  return hw;
}

export async function submitHomework(actor: Actor, homeworkId: string, answer: string) {
  if (actor.role !== "STUDENT" || !actor.studentId) throw new Error("Yetkisiz");
  const hw = await prisma.homework.findUnique({ where: { id: homeworkId } });
  if (!hw) throw new Error("Ödev yok");
  assertTenant(actor, hw.tenantId);
  const status = homeworkStatus(hw.dueDate, new Date(), todayIso());
  return prisma.homeworkSubmission.update({
    where: { homeworkId_studentId: { homeworkId, studentId: actor.studentId } },
    data: { answer, status: status === "LATE" ? "LATE" : "SUBMITTED", submittedAt: new Date() },
  });
}

export async function createCalendarEvent(
  actor: Actor,
  input: { branchId?: string; title: string; body: string; startsOn: string; endsOn: string; audience: string },
) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  if (input.branchId) assertBranch(actor, input.branchId);
  return prisma.calendarEvent.create({
    data: {
      tenantId,
      branchId: input.branchId || null,
      title: input.title,
      body: input.body,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      audience: input.audience,
    },
  });
}

export async function sendInboxMessage(
  actor: Actor,
  input: { recipientRole: string; subject: string; body: string; studentId?: string },
) {
  const tenantId = requireTenantId(actor);
  return prisma.inboxMessage.create({
    data: {
      tenantId,
      senderId: actor.id,
      recipientRole: input.recipientRole,
      studentId: input.studentId,
      subject: input.subject,
      body: input.body,
    },
  });
}

export async function logBehavior(
  actor: Actor,
  input: { branchId: string; studentId: string; kind: BehaviorKind; title: string; note: string; points: number },
) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.behaviorRecord.create({ data: { tenantId, authorId: actor.id, ...input } });
}

export async function logHealthVisit(
  actor: Actor,
  input: { branchId: string; studentId: string; complaint: string; treatment: string; heightCm?: number; weightKg?: number },
) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.healthVisit.create({ data: { tenantId, staffId: actor.id, ...input } });
}

export async function createBusRoute(
  actor: Actor,
  input: { branchId: string; name: string; vehicle: string; driver: string; plate: string; morningEta: string },
) {
  if (!canSeeFinance(actor.role) && !canManageOrg(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.busRoute.create({ data: { tenantId, ...input } });
}

export async function assignBus(actor: Actor, routeId: string, studentId: string, stopName: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const route = await prisma.busRoute.findUnique({ where: { id: routeId } });
  if (!route) throw new Error("Güzergâh yok");
  assertTenant(actor, route.tenantId);
  return prisma.busAssignment.upsert({
    where: { routeId_studentId: { routeId, studentId } },
    create: { routeId, studentId, stopName },
    update: { stopName },
  });
}

export async function createLibraryTitle(actor: Actor, title: string, author: string, copies: number) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  return prisma.libraryTitle.create({ data: { tenantId, title, author, copies } });
}

export async function loanBook(actor: Actor, titleId: string, studentId: string, dueDate: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  return prisma.libraryLoan.create({ data: { titleId, studentId, dueDate, status: "OUT" } });
}

export async function returnBook(actor: Actor, loanId: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  return prisma.libraryLoan.update({ where: { id: loanId }, data: { status: "RETURNED", returnedAt: new Date() } });
}

export async function createFee(actor: Actor, input: { branchId: string; studentId: string; title: string; amount: number; dueDate: string }) {
  if (!canSeeFinance(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  const status = feeStatus(input.amount, 0, input.dueDate, todayIso());
  return prisma.feeCharge.create({ data: { tenantId, paid: 0, status, ...input } });
}

export async function payFee(actor: Actor, feeId: string, amount: number) {
  if (!canSeeFinance(actor.role) && actor.role !== "PARENT") throw new Error("Yetkisiz");
  const fee = await prisma.feeCharge.findUnique({ where: { id: feeId } });
  if (!fee) throw new Error("Borç yok");
  assertTenant(actor, fee.tenantId);
  const paid = fee.paid + amount;
  const status = feeStatus(fee.amount, paid, fee.dueDate, todayIso());
  return prisma.feeCharge.update({ where: { id: feeId }, data: { paid, status } });
}

export async function createClub(actor: Actor, branchId: string, name: string, capacity: number) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, branchId);
  return prisma.club.create({ data: { tenantId, branchId, name, capacity } });
}

export async function joinClub(actor: Actor, clubId: string, studentId: string, preference: number) {
  const club = await prisma.club.findUnique({ where: { id: clubId }, include: { members: true } });
  if (!club) throw new Error("Kulüp yok");
  assertTenant(actor, club.tenantId);
  if (club.members.length >= club.capacity) throw new Error("Kulüp dolu");
  return prisma.clubMembership.create({ data: { clubId, studentId, preference, placed: true } });
}

export async function createTutoring(
  actor: Actor,
  input: { branchId: string; courseId: string; date: string; startTime: string; endTime: string; topic: string },
) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.tutoringSlot.create({ data: { tenantId, teacherId: actor.id, status: "OPEN", ...input } });
}

export async function bookTutoring(actor: Actor, slotId: string, studentId: string) {
  const slot = await prisma.tutoringSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new Error("Etüt yok");
  assertTenant(actor, slot.tenantId);
  if (slot.status !== "OPEN") throw new Error("Slot dolu");
  return prisma.tutoringSlot.update({ where: { id: slotId }, data: { studentId, status: "BOOKED" } });
}

export async function createLead(
  actor: Actor,
  input: {
    branchId: string;
    studentName: string;
    parentName: string;
    phone: string;
    gradeLevel: string;
    note: string;
    offeredFee?: number;
  },
) {
  if (!canSeeFinance(actor.role) && !canManageOrg(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.admissionLead.create({ data: { tenantId, ownerId: actor.id, status: "GUEST", ...input } });
}

export async function advanceLead(actor: Actor, leadId: string, status: LeadStatus) {
  const lead = await prisma.admissionLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Aday yok");
  assertTenant(actor, lead.tenantId);
  return prisma.admissionLead.update({ where: { id: leadId }, data: { status } });
}

export async function createSurvey(actor: Actor, title: string, question: string, audience: string, required: boolean) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  return prisma.survey.create({ data: { tenantId, title, question, audience, required } });
}

export async function answerSurvey(actor: Actor, surveyId: string, score: number, comment?: string) {
  return prisma.surveyResponse.create({
    data: { surveyId, authorName: actor.name, score, comment },
  });
}

export async function logStaffAbsence(
  actor: Actor,
  input: { branchId: string; userId: string; date: string; kind: AbsenceKind; note?: string },
) {
  if (!canManageOrg(actor.role) && actor.role !== "BRANCH_OPS") throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.staffAbsence.create({ data: { tenantId, ...input } });
}

export async function createDuty(actor: Actor, input: { branchId: string; userId: string; date: string; slot: string; place: string }) {
  if (!canManageOrg(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.dutyShift.create({ data: { tenantId, ...input } });
}

export async function shareDocument(actor: Actor, title: string, kind: string, audience: string, body: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  return prisma.sharedDocument.create({ data: { tenantId, authorId: actor.id, title, kind, audience, body } });
}

export async function logVisitor(actor: Actor, input: { branchId: string; visitorName: string; purpose: string }) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.visitorLog.create({ data: { tenantId, hostId: actor.id, ...input } });
}

export async function createMeal(actor: Actor, input: { branchId: string; date: string; meal: string; items: string }) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  assertBranch(actor, input.branchId);
  return prisma.mealMenu.create({ data: { tenantId, ...input } });
}

export async function awardAchievement(actor: Actor, studentId: string, title: string, badge: string, note: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  return prisma.achievement.create({ data: { tenantId, studentId, title, badge, note } });
}

export async function requestMeeting(
  actor: Actor,
  input: { branchId: string; teacherId: string; studentId: string; parentName: string; slot: string; mode: string; note?: string },
) {
  const tenantId = requireTenantId(actor);
  return prisma.parentMeeting.create({ data: { tenantId, status: "REQUESTED", ...input } });
}

export async function setMeetingStatus(actor: Actor, id: string, status: MeetingStatus) {
  return prisma.parentMeeting.update({ where: { id }, data: { status } });
}

export async function createTopic(actor: Actor, courseId: string, weekOf: string, title: string, outcomes: string) {
  if (!canUseSisWrite(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  return prisma.lessonTopic.create({ data: { tenantId, courseId, teacherId: actor.id, weekOf, title, outcomes } });
}

export async function upsertInventory(actor: Actor, input: { name: string; category: string; qty: number; location: string; assignedTo?: string }) {
  if (!canSeeFinance(actor.role) && !canManageOrg(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  return prisma.inventoryItem.create({ data: { tenantId, ...input } });
}

export async function student360(actor: Actor, studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      classroom: true,
      branch: true,
      grades: { include: { assessment: { include: { course: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      homeworkSubs: { include: { homework: { include: { course: true } } }, take: 12, orderBy: { homeworkId: "desc" } },
      behaviors: { orderBy: { createdAt: "desc" }, take: 8 },
      healthVisits: { orderBy: { createdAt: "desc" }, take: 5 },
      fees: { orderBy: { dueDate: "asc" } },
      clubs: { include: { club: true } },
      loans: { include: { title: true }, where: { status: "OUT" } },
      busAssignments: { include: { route: true } },
      achievements: { orderBy: { awardedAt: "desc" }, take: 6 },
      meetings: { include: { teacher: true }, take: 5 },
    },
  });
  if (!student) return null;
  assertTenant(actor, student.tenantId);
  if (actor.role === "PARENT") {
    const link = await prisma.parentStudent.findFirst({ where: { parentId: actor.id, studentId } });
    if (!link) throw new Error("Yetkisiz");
  }
  if (actor.role === "STUDENT" && actor.studentId !== studentId) throw new Error("Yetkisiz");
  const avg = weightedAverage(
    student.grades.map((g) => ({ score: g.score, maxScore: g.assessment.maxScore, weight: g.assessment.weight })),
  );
  return { student, avg, behavior: behaviorBalance(student.behaviors.map((b) => b.points)) };
}

export { scoped };
export type { TutoringStatus, LoanStatus, HomeworkStatus };
