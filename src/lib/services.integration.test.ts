import { describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { performCheckIn } from "./services";
import type { Actor } from "./types";

describe("web check-in iş kuralları (seed DB)", () => {
  it("mükerrer sınıf check-in'ini yok sayar", async () => {
    const teacher = await prisma.user.findUnique({ where: { email: "ogretmen@cankaya.local" } });
    const student = await prisma.student.findFirst({ where: { studentNo: "202612001" } });
    const location = await prisma.location.findFirst({ where: { name: "12-A Kapısı" } });
    expect(teacher && student && location).toBeTruthy();
    const actor: Actor = {
      id: teacher!.id,
      name: teacher!.name,
      email: teacher!.email,
      role: teacher!.role,
      tenantId: teacher!.tenantId,
      branchIds: [student!.branchId],
    };
    const first = await performCheckIn({
      actor,
      studentId: student!.id,
      locationId: location!.id,
      source: "KIOSK",
    });
    const second = await performCheckIn({
      actor,
      studentId: student!.id,
      locationId: location!.id,
      source: "KIOSK",
    });
    expect(["COUNTED", "BUFFERED", "IGNORED"]).toContain(first.event.result);
    if (first.event.result === "COUNTED" || first.event.result === "BUFFERED") {
      expect(second.event.result).toBe("IGNORED");
    }
  });
});
