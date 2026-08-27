"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { storeUpload } from "@/lib/uploads";
import type {
  AssignmentStatus,
  CalendarEventType,
  ExamType,
  FeePeriod,
  MaterialVisibility,
  PaymentMethod,
  TermStatus,
} from "@prisma/client";
import {
  cancelInvoice,
  deleteAnnouncement,
  deleteAssignment,
  deleteCalendarEvent,
  deleteExam,
  deleteFeeType,
  deleteMaterial,
  deletePayment,
  deleteTeacherNote,
  deleteTerm,
  generateReportCards,
  gradeSubmission,
  publishReportCard,
  recordPayment,
  setCurrentTerm,
  setExamPublished,
  submitAssignment,
  updateMaterial,
  upsertAnnouncement,
  upsertAssignment,
  upsertCalendarEvent,
  upsertExam,
  upsertExamScore,
  upsertFeeType,
  upsertInvoice,
  upsertTeacherNote,
  upsertTerm,
  createMaterial,
} from "@/lib/sis-service";

function fd(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function bounce(path: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : "İşlem başarısız";
  redirect(`${path}?err=${encodeURIComponent(msg)}`);
}

async function run(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    bounce(path, e);
  }
}

export async function saveTerm(form: FormData) {
  const actor = await requireActor();
  await run("/panel/donemler", () =>
    upsertTerm(actor, {
      id: fd(form, "id") || undefined,
      name: fd(form, "name"),
      startDate: fd(form, "startDate"),
      endDate: fd(form, "endDate"),
      status: (fd(form, "status") || "PLANNED") as TermStatus,
      isCurrent: form.get("isCurrent") === "on",
    }),
  );
  revalidatePath("/panel/donemler");
}

export async function setCurrentTermAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/donemler", () => setCurrentTerm(actor, fd(form, "id")));
  revalidatePath("/panel/donemler");
}

export async function deleteTermAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/donemler", () => deleteTerm(actor, fd(form, "id")));
  revalidatePath("/panel/donemler");
}

export async function saveCalendarEvent(form: FormData) {
  const actor = await requireActor();
  await run("/panel/takvim", () =>
    upsertCalendarEvent(actor, {
      id: fd(form, "id") || undefined,
      branchId: fd(form, "branchId") || null,
      termId: fd(form, "termId") || null,
      title: fd(form, "title"),
      body: fd(form, "body"),
      startsAt: fd(form, "startsAt"),
      endsAt: fd(form, "endsAt"),
      allDay: form.get("allDay") === "on",
      type: (fd(form, "type") || "OTHER") as CalendarEventType,
      audience: form.getAll("audience").map(String),
    }),
  );
  revalidatePath("/panel/takvim");
}

export async function deleteCalendarEventAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/takvim", () => deleteCalendarEvent(actor, fd(form, "id")));
  revalidatePath("/panel/takvim");
}

export async function saveExam(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await run(id ? `/panel/sinavlar/${id}` : "/panel/sinavlar", () =>
    upsertExam(actor, {
      id: id || undefined,
      termId: fd(form, "termId"),
      branchId: fd(form, "branchId"),
      courseId: fd(form, "courseId"),
      classroomId: fd(form, "classroomId") || null,
      teacherId: fd(form, "teacherId") || undefined,
      name: fd(form, "name"),
      examDate: fd(form, "examDate"),
      examType: (fd(form, "examType") || "WRITTEN") as ExamType,
      maxScore: Number(fd(form, "maxScore") || 100),
      weight: Number(fd(form, "weight") || 1),
      published: form.get("published") === "on",
    }),
  );
  revalidatePath("/panel/sinavlar");
}

export async function deleteExamAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/sinavlar", () => deleteExam(actor, fd(form, "id")));
  revalidatePath("/panel/sinavlar");
}

export async function saveExamScores(form: FormData) {
  const actor = await requireActor();
  const examId = fd(form, "examId");
  await run(`/panel/sinavlar/${examId}`, async () => {
    const studentIds = form.getAll("studentId").map(String);
    for (const studentId of studentIds) {
      const raw = fd(form, `score_${studentId}`);
      if (raw === "") continue;
      await upsertExamScore(actor, {
        examId,
        studentId,
        score: Number(raw),
        note: fd(form, `note_${studentId}`) || null,
      });
    }
    await setExamPublished(actor, examId, form.get("published") === "on");
  });
  revalidatePath(`/panel/sinavlar/${examId}`);
  revalidatePath("/panel/notlar");
}

export async function saveAssignment(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await run(id ? `/panel/odevler/${id}` : "/panel/odevler", () =>
    upsertAssignment(actor, {
      id: id || undefined,
      termId: fd(form, "termId") || null,
      branchId: fd(form, "branchId"),
      courseId: fd(form, "courseId"),
      classroomId: fd(form, "classroomId"),
      teacherId: fd(form, "teacherId") || undefined,
      title: fd(form, "title"),
      body: fd(form, "body"),
      dueAt: fd(form, "dueAt"),
      maxScore: Number(fd(form, "maxScore") || 100),
      weight: Number(fd(form, "weight") || 1),
      published: form.get("published") === "on",
      status: (fd(form, "status") || "PUBLISHED") as AssignmentStatus,
    }),
  );
  revalidatePath("/panel/odevler");
}

export async function deleteAssignmentAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/odevler", () => deleteAssignment(actor, fd(form, "id")));
  revalidatePath("/panel/odevler");
}

export async function gradeSubmissionAction(form: FormData) {
  const actor = await requireActor();
  const assignmentId = fd(form, "assignmentId");
  await run(`/panel/odevler/${assignmentId}`, () =>
    gradeSubmission(actor, {
      submissionId: fd(form, "submissionId"),
      score: Number(fd(form, "score")),
      feedback: fd(form, "feedback") || null,
    }),
  );
  revalidatePath(`/panel/odevler/${assignmentId}`);
}

export async function submitHomeworkAction(form: FormData) {
  const actor = await requireActor();
  const assignmentId = fd(form, "assignmentId");
  await run(`/ogrenci/odevler/${assignmentId}`, async () => {
    const file = form.get("file");
    let uploaded = null;
    if (file instanceof File && file.size > 0) uploaded = await storeUpload(file);
    await submitAssignment(actor, {
      assignmentId,
      body: fd(form, "body"),
      file: uploaded,
    });
  });
  revalidatePath(`/ogrenci/odevler/${assignmentId}`);
  revalidatePath("/ogrenci/odevler");
}

export async function saveMaterialAction(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await run("/panel/materyaller", async () => {
    if (id) {
      await updateMaterial(actor, {
        id,
        title: fd(form, "title"),
        description: fd(form, "description"),
        visibility: (fd(form, "visibility") || "CLASS") as MaterialVisibility,
        branchId: fd(form, "branchId") || null,
        courseId: fd(form, "courseId") || null,
        classroomId: fd(form, "classroomId") || null,
      });
      return;
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Dosya gerekli.");
    const stored = await storeUpload(file);
    await createMaterial(actor, {
      title: fd(form, "title"),
      description: fd(form, "description"),
      visibility: (fd(form, "visibility") || "CLASS") as MaterialVisibility,
      branchId: fd(form, "branchId") || null,
      courseId: fd(form, "courseId") || null,
      classroomId: fd(form, "classroomId") || null,
      file: stored,
    });
  });
  revalidatePath("/panel/materyaller");
}

export async function deleteMaterialAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/materyaller", () => deleteMaterial(actor, fd(form, "id")));
  revalidatePath("/panel/materyaller");
}

export async function saveFeeType(form: FormData) {
  const actor = await requireActor();
  await run("/panel/ucretler", () =>
    upsertFeeType(actor, {
      id: fd(form, "id") || undefined,
      name: fd(form, "name"),
      amount: Number(fd(form, "amount")),
      period: (fd(form, "period") || "TERM") as FeePeriod,
      description: fd(form, "description") || null,
      status: fd(form, "status") || "ACTIVE",
    }),
  );
  revalidatePath("/panel/ucretler");
}

export async function deleteFeeTypeAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/ucretler", () => deleteFeeType(actor, fd(form, "id")));
  revalidatePath("/panel/ucretler");
}

export async function saveInvoice(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await run(id ? `/panel/ucretler/${id}` : "/panel/ucretler", () =>
    upsertInvoice(actor, {
      id: id || undefined,
      studentId: fd(form, "studentId"),
      feeTypeId: fd(form, "feeTypeId") || null,
      title: fd(form, "title"),
      amount: Number(fd(form, "amount")),
      dueDate: fd(form, "dueDate"),
      note: fd(form, "note") || null,
    }),
  );
  revalidatePath("/panel/ucretler");
}

export async function cancelInvoiceAction(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await run(`/panel/ucretler/${id}`, () => cancelInvoice(actor, id));
  revalidatePath(`/panel/ucretler/${id}`);
  revalidatePath("/panel/ucretler");
}

export async function recordPaymentAction(form: FormData) {
  const actor = await requireActor();
  const invoiceId = fd(form, "invoiceId");
  await run(`/panel/ucretler/${invoiceId}`, () =>
    recordPayment(actor, {
      invoiceId,
      amount: Number(fd(form, "amount")),
      method: (fd(form, "method") || "CASH") as PaymentMethod,
      note: fd(form, "note") || null,
      paidAt: fd(form, "paidAt") || undefined,
    }),
  );
  revalidatePath(`/panel/ucretler/${invoiceId}`);
  revalidatePath("/panel/ucretler");
}

export async function deletePaymentAction(form: FormData) {
  const actor = await requireActor();
  const invoiceId = fd(form, "invoiceId");
  await run(`/panel/ucretler/${invoiceId}`, () => deletePayment(actor, fd(form, "id")));
  revalidatePath(`/panel/ucretler/${invoiceId}`);
}

export async function saveTeacherNoteAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/ogretmen-notlari", () =>
    upsertTeacherNote(actor, {
      id: fd(form, "id") || undefined,
      studentId: fd(form, "studentId"),
      body: fd(form, "body"),
    }),
  );
  revalidatePath("/panel/ogretmen-notlari");
}

export async function deleteTeacherNoteAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/ogretmen-notlari", () => deleteTeacherNote(actor, fd(form, "id")));
  revalidatePath("/panel/ogretmen-notlari");
}

export async function generateReportCardsAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/karne", () => generateReportCards(actor, fd(form, "termId"), fd(form, "classroomId") || undefined));
  revalidatePath("/panel/karne");
}

export async function publishReportCardAction(form: FormData) {
  const actor = await requireActor();
  const id = fd(form, "id");
  await run("/panel/karne", () => publishReportCard(actor, id, fd(form, "published") === "1"));
  revalidatePath("/panel/karne");
  revalidatePath(`/panel/karne/${id}`);
}

export async function saveAnnouncementAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/duyurular", () =>
    upsertAnnouncement(actor, {
      id: fd(form, "id") || undefined,
      title: fd(form, "title"),
      body: fd(form, "body"),
      branchId: fd(form, "branchId") || null,
      audience: form.getAll("audience").map(String),
    }),
  );
  revalidatePath("/panel/duyurular");
}

export async function deleteAnnouncementAction(form: FormData) {
  const actor = await requireActor();
  await run("/panel/duyurular", () => deleteAnnouncement(actor, fd(form, "id")));
  revalidatePath("/panel/duyurular");
}
