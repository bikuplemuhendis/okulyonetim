import { prisma } from "./prisma";
import type { Actor } from "./types";
import { assertBranch, canManageOrg, requireTenantId } from "./rbac";
import { canUseSisWrite } from "./sis";

export function canWriteDaily(role: Actor["role"]) {
  return canUseSisWrite(role) || canManageOrg(role);
}

export async function upsertDailyReport(
  actor: Actor,
  input: {
    studentId: string;
    date: string;
    mood: string;
    meals: string;
    sleepMinutes: number;
    toilet: string;
    activities: string;
    photoNote?: string;
    note: string;
  },
) {
  if (!canWriteDaily(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student || student.tenantId !== tenantId) throw new Error("Çocuk bulunamadı");
  assertBranch(actor, student.branchId);
  return prisma.dailyReport.upsert({
    where: { studentId_date: { studentId: input.studentId, date: input.date } },
    create: { tenantId, authorId: actor.id, ...input, sleepMinutes: input.sleepMinutes || 0 },
    update: {
      mood: input.mood,
      meals: input.meals,
      sleepMinutes: input.sleepMinutes || 0,
      toilet: input.toilet,
      activities: input.activities,
      photoNote: input.photoNote,
      note: input.note,
      authorId: actor.id,
    },
  });
}

export async function addPickupContact(
  actor: Actor,
  input: { studentId: string; name: string; phone: string; relation: string },
) {
  if (!canWriteDaily(actor.role)) throw new Error("Yetkisiz");
  const tenantId = requireTenantId(actor);
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student || student.tenantId !== tenantId) throw new Error("Kayıt yok");
  assertBranch(actor, student.branchId);
  return prisma.pickupContact.create({ data: { tenantId, ...input } });
}
