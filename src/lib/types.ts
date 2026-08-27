import type { Role } from "@prisma/client";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  branchIds: string[];
  studentId?: string | null;
};

export const SESSION_COOKIE = "kampus_session";
export const TENANT_COOKIE = "kampus_tenant";
export const DEMO_PASSWORD = "Demo123!";

export const ROLE_LABELS: Record<Role, string> = {
  PLATFORM_SUPER_ADMIN: "Platform Süper Admin",
  TENANT_OWNER: "Firma Sahibi",
  TENANT_OPS: "Firma Operasyon",
  BRANCH_MANAGER: "Şube Müdürü",
  BRANCH_OPS: "Şube Operasyon",
  TEACHER: "Öğretmen",
  COUNSELOR: "Rehberlik",
  PARENT: "Veli",
  STUDENT: "Öğrenci",
};

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
