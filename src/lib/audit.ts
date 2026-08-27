import { prisma } from "./prisma";
import type { Actor } from "./types";

export async function writeAudit(opts: {
  actor?: Actor | null;
  tenantId?: string | null;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  result?: string;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: opts.tenantId ?? opts.actor?.tenantId ?? null,
      branchId: opts.branchId ?? null,
      actorId: opts.actor?.id ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      oldValue: opts.oldValue == null ? null : JSON.stringify(opts.oldValue),
      newValue: opts.newValue == null ? null : JSON.stringify(opts.newValue),
      result: opts.result ?? "SUCCESS",
      ip: opts.ip,
      userAgent: opts.userAgent,
    },
  });
}
