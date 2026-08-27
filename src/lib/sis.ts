import type { Role } from "@prisma/client";

export type WeightedItem = { score: number; maxScore: number; weight: number };

export function clampScore(score: number, maxScore: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    throw new Error("Puan veya tam puan geçersiz.");
  }
  if (score < 0 || score > maxScore) {
    throw new Error(`Puan 0 ile ${maxScore} arasında olmalı.`);
  }
  return score;
}

export function normalizeTo100(score: number, maxScore: number) {
  const s = clampScore(score, maxScore);
  return (s / maxScore) * 100;
}

export function weightedAverage(items: WeightedItem[]): number | null {
  const usable = items.filter((i) => Number.isFinite(i.score) && i.maxScore > 0 && i.weight > 0);
  if (!usable.length) return null;
  const weightSum = usable.reduce((a, i) => a + i.weight, 0);
  const acc = usable.reduce((a, i) => a + normalizeTo100(i.score, i.maxScore) * i.weight, 0);
  return Math.round((acc / weightSum) * 100) / 100;
}

export function letterFromPercent(percent: number): string {
  if (percent >= 90) return "AA";
  if (percent >= 85) return "BA";
  if (percent >= 80) return "BB";
  if (percent >= 75) return "CB";
  if (percent >= 70) return "CC";
  if (percent >= 60) return "DC";
  if (percent >= 50) return "DD";
  return "FF";
}

export function fivePointFromPercent(percent: number): number {
  if (percent >= 85) return 5;
  if (percent >= 70) return 4;
  if (percent >= 60) return 3;
  if (percent >= 50) return 2;
  return 1;
}

export function invoicePaidTotal(payments: { amount: number }[]) {
  return Math.round(payments.reduce((a, p) => a + p.amount, 0) * 100) / 100;
}

export function invoiceBalance(amount: number, payments: { amount: number }[]) {
  return Math.round((amount - invoicePaidTotal(payments)) * 100) / 100;
}

export function invoiceStatusFromBalance(
  amount: number,
  payments: { amount: number }[],
  cancelled: boolean,
): "OPEN" | "PARTIAL" | "PAID" | "CANCELLED" {
  if (cancelled) return "CANCELLED";
  const paid = invoicePaidTotal(payments);
  if (paid <= 0) return "OPEN";
  if (paid + 0.009 >= amount) return "PAID";
  return "PARTIAL";
}

export function assertPaymentAmount(amount: number, remaining: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Tahsilat tutarı 0'dan büyük olmalı.");
  }
  if (amount - remaining > 0.009) {
    throw new Error("Tahsilat kalan bakiyeyi aşamaz.");
  }
}

export function canViewTeacherNote(opts: { actorId: string; actorRole: Role; noteTeacherId: string }) {
  if (opts.actorId === opts.noteTeacherId) return true;
  if (opts.actorRole === "TEACHER") return false;
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "BRANCH_MANAGER"].includes(opts.actorRole);
}

export function parentOwnsStudent(parentId: string, links: { parentId: string; studentId: string }[], studentId: string) {
  return links.some((l) => l.parentId === parentId && l.studentId === studentId);
}

export function formatTry(amount: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

export const EXAM_TYPE_LABELS: Record<string, string> = {
  WRITTEN: "Yazılı",
  ORAL: "Sözlü",
  PRACTICAL: "Uygulama",
};

export const FEE_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  TERM: "Dönemlik",
  YEAR: "Yıllık",
  ONE_OFF: "Tek sefer",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Açık",
  PARTIAL: "Kısmi",
  PAID: "Ödendi",
  CANCELLED: "İptal",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Nakit",
  TRANSFER: "Havale",
  CARD: "Kart",
  OTHER: "Diğer",
};

export const MATERIAL_VISIBILITY_LABELS: Record<string, string> = {
  PRIVATE: "Yalnızca ben",
  CLASS: "Sınıf",
  COURSE: "Ders",
  BRANCH: "Şube",
};

export const CALENDAR_TYPE_LABELS: Record<string, string> = {
  HOLIDAY: "Tatil",
  EXAM: "Sınav",
  MEETING: "Toplantı",
  TERM: "Dönem",
  OTHER: "Diğer",
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayımlı",
  CLOSED: "Kapalı",
};

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  SUBMITTED: "Teslim",
  GRADED: "Notlandı",
  LATE: "Geç teslim",
};

export const TERM_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planlı",
  ACTIVE: "Aktif",
  CLOSED: "Kapalı",
};
