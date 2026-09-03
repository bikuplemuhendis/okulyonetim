"use server";

import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import {
  advanceLead,
  answerSurvey,
  assignBus,
  awardAchievement,
  bookTutoring,
  createAssessment,
  createBusRoute,
  createCalendarEvent,
  createClub,
  createDuty,
  createFee,
  createHomework,
  createLead,
  createLibraryTitle,
  createMeal,
  createSurvey,
  createTopic,
  createTutoring,
  joinClub,
  loanBook,
  logBehavior,
  logHealthVisit,
  logStaffAbsence,
  logVisitor,
  payFee,
  requestMeeting,
  returnBook,
  sendInboxMessage,
  setMeetingStatus,
  shareDocument,
  submitHomework,
  upsertGrade,
  upsertInventory,
} from "@/lib/sis";
import type { AbsenceKind, AssessmentKind, BehaviorKind, LeadStatus, MeetingStatus } from "@prisma/client";

function fd(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string) {
  return Number(fd(form, key));
}

function bounce(path: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : "İşlem başarısız";
  redirect(`${path}?err=${encodeURIComponent(msg)}`);
}

async function ok(path: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    bounce(path, e);
  }
  redirect(`${path}?ok=${encodeURIComponent("Kaydedildi")}`);
}

export async function saveAssessmentAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/notlar", () =>
    createAssessment(actor, {
      branchId: fd(form, "branchId"),
      courseId: fd(form, "courseId"),
      title: fd(form, "title"),
      kind: fd(form, "kind") as AssessmentKind,
      examDate: fd(form, "examDate"),
      maxScore: num(form, "maxScore"),
      weight: num(form, "weight") || 1,
      countsForReport: fd(form, "countsForReport") === "on",
    }),
  );
}

export async function saveGradeAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/notlar", () =>
    upsertGrade(actor, fd(form, "assessmentId"), fd(form, "studentId"), num(form, "score"), fd(form, "comment") || undefined),
  );
}

export async function saveHomeworkAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/odevler", () =>
    createHomework(actor, {
      branchId: fd(form, "branchId"),
      courseId: fd(form, "courseId"),
      classroomId: fd(form, "classroomId"),
      title: fd(form, "title"),
      instructions: fd(form, "instructions"),
      dueDate: fd(form, "dueDate"),
      kind: fd(form, "kind") || "TEXT",
    }),
  );
}

export async function submitHomeworkAction(form: FormData) {
  const actor = await requireActor();
  await ok("/ogrenci/odevler", () => submitHomework(actor, fd(form, "homeworkId"), fd(form, "answer")));
}

export async function saveEventAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/takvim", () =>
    createCalendarEvent(actor, {
      branchId: fd(form, "branchId") || undefined,
      title: fd(form, "title"),
      body: fd(form, "body"),
      startsOn: fd(form, "startsOn"),
      endsOn: fd(form, "endsOn"),
      audience: fd(form, "audience") || '["PARENT","STUDENT","TEACHER"]',
    }),
  );
}

export async function sendMessageAction(form: FormData) {
  const actor = await requireActor();
  const path = actor.role === "PARENT" ? "/veli/mesajlar" : "/panel/mesajlar";
  await ok(path, () =>
    sendInboxMessage(actor, {
      recipientRole: fd(form, "recipientRole"),
      subject: fd(form, "subject"),
      body: fd(form, "body"),
      studentId: fd(form, "studentId") || undefined,
    }),
  );
}

export async function saveBehaviorAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/davranis", () =>
    logBehavior(actor, {
      branchId: fd(form, "branchId"),
      studentId: fd(form, "studentId"),
      kind: fd(form, "kind") as BehaviorKind,
      title: fd(form, "title"),
      note: fd(form, "note"),
      points: num(form, "points"),
    }),
  );
}

export async function saveHealthAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/saglik", () =>
    logHealthVisit(actor, {
      branchId: fd(form, "branchId"),
      studentId: fd(form, "studentId"),
      complaint: fd(form, "complaint"),
      treatment: fd(form, "treatment"),
      heightCm: fd(form, "heightCm") ? num(form, "heightCm") : undefined,
      weightKg: fd(form, "weightKg") ? num(form, "weightKg") : undefined,
    }),
  );
}

export async function saveBusRouteAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/servis", () =>
    createBusRoute(actor, {
      branchId: fd(form, "branchId"),
      name: fd(form, "name"),
      vehicle: fd(form, "vehicle"),
      driver: fd(form, "driver"),
      plate: fd(form, "plate"),
      morningEta: fd(form, "morningEta"),
    }),
  );
}

export async function assignBusAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/servis", () => assignBus(actor, fd(form, "routeId"), fd(form, "studentId"), fd(form, "stopName")));
}

export async function saveBookAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kutuphane", () => createLibraryTitle(actor, fd(form, "title"), fd(form, "author"), num(form, "copies") || 1));
}

export async function loanBookAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kutuphane", () => loanBook(actor, fd(form, "titleId"), fd(form, "studentId"), fd(form, "dueDate")));
}

export async function returnBookAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kutuphane", () => returnBook(actor, fd(form, "loanId")));
}

export async function saveFeeAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/finans", () =>
    createFee(actor, {
      branchId: fd(form, "branchId"),
      studentId: fd(form, "studentId"),
      title: fd(form, "title"),
      amount: num(form, "amount"),
      dueDate: fd(form, "dueDate"),
    }),
  );
}

export async function payFeeAction(form: FormData) {
  const actor = await requireActor();
  const path = actor.role === "PARENT" ? "/veli/odeme" : "/panel/finans";
  await ok(path, () => payFee(actor, fd(form, "feeId"), num(form, "amount")));
}

export async function saveClubAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kulupler", () => createClub(actor, fd(form, "branchId"), fd(form, "name"), num(form, "capacity") || 24));
}

export async function joinClubAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kulupler", () => joinClub(actor, fd(form, "clubId"), fd(form, "studentId"), num(form, "preference") || 1));
}

export async function saveTutoringAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/etut", () =>
    createTutoring(actor, {
      branchId: fd(form, "branchId"),
      courseId: fd(form, "courseId"),
      date: fd(form, "date"),
      startTime: fd(form, "startTime"),
      endTime: fd(form, "endTime"),
      topic: fd(form, "topic"),
    }),
  );
}

export async function bookTutoringAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/etut", () => bookTutoring(actor, fd(form, "slotId"), fd(form, "studentId")));
}

export async function saveLeadAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kayit", () =>
    createLead(actor, {
      branchId: fd(form, "branchId"),
      studentName: fd(form, "studentName"),
      parentName: fd(form, "parentName"),
      phone: fd(form, "phone"),
      gradeLevel: fd(form, "gradeLevel"),
      note: fd(form, "note"),
      offeredFee: fd(form, "offeredFee") ? num(form, "offeredFee") : undefined,
    }),
  );
}

export async function advanceLeadAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/kayit", () => advanceLead(actor, fd(form, "leadId"), fd(form, "status") as LeadStatus));
}

export async function saveSurveyAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/anketler", () =>
    createSurvey(actor, fd(form, "title"), fd(form, "question"), fd(form, "audience"), fd(form, "required") === "on"),
  );
}

export async function answerSurveyAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/anketler", () => answerSurvey(actor, fd(form, "surveyId"), num(form, "score"), fd(form, "comment") || undefined));
}

export async function saveStaffAbsenceAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/personel-devam", () =>
    logStaffAbsence(actor, {
      branchId: fd(form, "branchId"),
      userId: fd(form, "userId"),
      date: fd(form, "date"),
      kind: fd(form, "kind") as AbsenceKind,
      note: fd(form, "note") || undefined,
    }),
  );
}

export async function saveDutyAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/nobet", () =>
    createDuty(actor, {
      branchId: fd(form, "branchId"),
      userId: fd(form, "userId"),
      date: fd(form, "date"),
      slot: fd(form, "slot"),
      place: fd(form, "place"),
    }),
  );
}

export async function saveDocumentAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/belgeler", () => shareDocument(actor, fd(form, "title"), fd(form, "kind"), fd(form, "audience"), fd(form, "body")));
}

export async function saveVisitorAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/ziyaretci", () =>
    logVisitor(actor, { branchId: fd(form, "branchId"), visitorName: fd(form, "visitorName"), purpose: fd(form, "purpose") }),
  );
}

export async function saveMealAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/yemekhane", () =>
    createMeal(actor, { branchId: fd(form, "branchId"), date: fd(form, "date"), meal: fd(form, "meal"), items: fd(form, "items") }),
  );
}

export async function saveAchievementAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/basarilar", () =>
    awardAchievement(actor, fd(form, "studentId"), fd(form, "title"), fd(form, "badge"), fd(form, "note")),
  );
}

export async function requestMeetingAction(form: FormData) {
  const actor = await requireActor();
  const path = actor.role === "PARENT" ? "/veli/randevu" : "/panel/randevu";
  await ok(path, () =>
    requestMeeting(actor, {
      branchId: fd(form, "branchId"),
      teacherId: fd(form, "teacherId"),
      studentId: fd(form, "studentId"),
      parentName: fd(form, "parentName") || actor.name,
      slot: fd(form, "slot"),
      mode: fd(form, "mode") || "YUZ_YUZE",
      note: fd(form, "note") || undefined,
    }),
  );
}

export async function setMeetingAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/randevu", () => setMeetingStatus(actor, fd(form, "id"), fd(form, "status") as MeetingStatus));
}

export async function saveTopicAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/konular", () => createTopic(actor, fd(form, "courseId"), fd(form, "weekOf"), fd(form, "title"), fd(form, "outcomes")));
}

export async function saveInventoryAction(form: FormData) {
  const actor = await requireActor();
  await ok("/panel/stok", () =>
    upsertInventory(actor, {
      name: fd(form, "name"),
      category: fd(form, "category"),
      qty: num(form, "qty"),
      location: fd(form, "location"),
      assignedTo: fd(form, "assignedTo") || undefined,
    }),
  );
}
