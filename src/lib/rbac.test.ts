import { describe, expect, it } from "vitest";
import {
  canAssignRole,
  canEnterGrades,
  canManageBranches,
  canManageFinance,
  canManageStudents,
  canManageTerms,
  requireTenantId,
} from "./rbac";
import type { Actor } from "./types";
import { composeClassroomName, inferGradeBand } from "./domain";

describe("rol atama", () => {
  it("şube müdürü firma sahibi atayamaz", () => {
    expect(canAssignRole("BRANCH_MANAGER", "TENANT_OWNER")).toBe(false);
    expect(canAssignRole("BRANCH_MANAGER", "TEACHER")).toBe(true);
  });
  it("firma operasyon süper admin atayamaz", () => {
    expect(canAssignRole("TENANT_OPS", "PLATFORM_SUPER_ADMIN")).toBe(false);
    expect(canAssignRole("TENANT_OPS", "BRANCH_MANAGER")).toBe(true);
  });
  it("şube oluşturma şube müdürüne kapalıdır", () => {
    expect(canManageBranches("BRANCH_MANAGER")).toBe(false);
    expect(canManageBranches("TENANT_OWNER")).toBe(true);
  });
  it("sekreter öğrenci yönetebilir", () => {
    expect(canManageStudents("BRANCH_OPS")).toBe(true);
  });
});

describe("tenant bağlamı", () => {
  it("platform firma seçmeden org yazamaz", () => {
    const actor: Actor = {
      id: "1",
      name: "P",
      email: "p@x",
      role: "PLATFORM_SUPER_ADMIN",
      tenantId: null,
      branchIds: [],
    };
    expect(() => requireTenantId(actor)).toThrow(/firma/);
  });
});

describe("sis yetkileri", () => {
  it("öğretmen not girer, veli girmez", () => {
    expect(canEnterGrades("TEACHER")).toBe(true);
    expect(canEnterGrades("PARENT")).toBe(false);
  });
  it("sekreterlik tahsilat yapar", () => {
    expect(canManageFinance("BRANCH_OPS")).toBe(true);
    expect(canManageFinance("TEACHER")).toBe(false);
  });
  it("dönem yönetimini öğretmene kapatır", () => {
    expect(canManageTerms("TEACHER")).toBe(false);
    expect(canManageTerms("TENANT_OWNER")).toBe(true);
  });
});

describe("sınıf adı", () => {
  it("seviye ve şube harfini birleştirir", () => {
    expect(composeClassroomName("12", "A")).toBe("12-A");
    expect(inferGradeBand("12")).toBe("LISE");
    expect(inferGradeBand("5")).toBe("ORTAOKUL");
  });
});
