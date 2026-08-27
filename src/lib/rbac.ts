import { Role } from "@prisma/client";
import type { Actor } from "./types";

export const ALL_ROLES: Role[] = [
  "PLATFORM_SUPER_ADMIN",
  "TENANT_OWNER",
  "TENANT_OPS",
  "BRANCH_MANAGER",
  "BRANCH_OPS",
  "TEACHER",
  "COUNSELOR",
  "PARENT",
  "STUDENT",
];

export function isPlatform(role: Role) {
  return role === "PLATFORM_SUPER_ADMIN";
}

export function isTenantWide(role: Role) {
  return role === "TENANT_OWNER" || role === "TENANT_OPS" || isPlatform(role);
}

export function canManageOrg(role: Role) {
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER"].includes(role);
}

export function canStartSession(role: Role) {
  return ["TEACHER", "BRANCH_MANAGER", "TENANT_OWNER", "PLATFORM_SUPER_ADMIN"].includes(role);
}

export function canSendBulk(role: Role) {
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "BRANCH_MANAGER", "BRANCH_OPS", "COUNSELOR"].includes(
    role,
  );
}

export function canExport(role: Role) {
  return !["PARENT", "STUDENT"].includes(role);
}

export function assertTenant(actor: Actor, tenantId: string | null | undefined) {
  if (isPlatform(actor.role)) return;
  if (!actor.tenantId || !tenantId || actor.tenantId !== tenantId) {
    throw new Error("Tenant kapsamı dışında.");
  }
}

export function assertBranch(actor: Actor, branchId: string | null | undefined) {
  if (isTenantWide(actor.role)) return;
  if (!branchId || !actor.branchIds.includes(branchId)) {
    throw new Error("Şube kapsamı dışında.");
  }
}

export function tenantFilter(actor: Actor): { tenantId?: string } {
  if (isPlatform(actor.role)) return {};
  if (!actor.tenantId) throw new Error("Tenant atanmamış.");
  return { tenantId: actor.tenantId };
}

export function homePath(role: Role) {
  if (role === "PARENT") return "/veli";
  if (role === "STUDENT") return "/ogrenci";
  return "/panel";
}
