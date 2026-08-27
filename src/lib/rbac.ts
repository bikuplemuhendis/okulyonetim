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

export function canManageBranches(role: Role) {
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(role);
}

export function canManageAcademic(role: Role) {
  return canManageOrg(role);
}

export function canManageStaff(role: Role) {
  return canManageOrg(role);
}

export function canManageStudents(role: Role) {
  return canManageOrg(role) || role === "BRANCH_OPS";
}

export function canAssignRole(actorRole: Role, targetRole: Role) {
  if (targetRole === "PLATFORM_SUPER_ADMIN") return actorRole === "PLATFORM_SUPER_ADMIN";
  if (actorRole === "PLATFORM_SUPER_ADMIN" || actorRole === "TENANT_OWNER") return true;
  if (actorRole === "TENANT_OPS") {
    return !["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"].includes(targetRole);
  }
  if (actorRole === "BRANCH_MANAGER") {
    return ["TEACHER", "COUNSELOR", "BRANCH_OPS", "PARENT", "STUDENT"].includes(targetRole);
  }
  return false;
}

export function assignableRoles(actorRole: Role): Role[] {
  return ALL_ROLES.filter((r) => canAssignRole(actorRole, r));
}

export function requireTenantId(actor: Actor): string {
  if (!actor.tenantId) {
    if (isPlatform(actor.role)) {
      throw new Error("Önce üst menüden bir firma seçin.");
    }
    throw new Error("Tenant atanmamış.");
  }
  return actor.tenantId;
}

export function canEnterGrades(role: Role) {
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER", "TEACHER"].includes(role);
}

export function canViewStaffGrades(role: Role) {
  return canEnterGrades(role) || role === "COUNSELOR" || role === "BRANCH_OPS";
}

export function canManageFinance(role: Role) {
  return ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER", "BRANCH_OPS"].includes(
    role,
  );
}

export function canManageCalendar(role: Role) {
  return canManageFinance(role);
}

export function canManageTerms(role: Role) {
  return canManageAcademic(role);
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
  if (isPlatform(actor.role)) {
    if (actor.tenantId && tenantId && actor.tenantId !== tenantId) {
      throw new Error("Tenant kapsamı dışında.");
    }
    return;
  }
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
  if (actor.tenantId) return { tenantId: actor.tenantId };
  if (isPlatform(actor.role)) return {};
  throw new Error("Tenant atanmamış.");
}

export function homePath(role: Role) {
  if (role === "PARENT") return "/veli";
  if (role === "STUDENT") return "/ogrenci";
  return "/panel";
}
