import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  createTenant,
  linkParent,
  upsertBranch,
  upsertClassroom,
  upsertCourse,
  upsertLocation,
  upsertSchedule,
  upsertStudent,
  upsertUser,
  validateAcademicRange,
} from "./org";
import type { Actor } from "./types";
import bcrypt from "bcryptjs";

function actor(partial: Partial<Actor> & Pick<Actor, "role" | "tenantId">): Actor {
  return {
    id: partial.id ?? "actor",
    name: partial.name ?? "Test",
    email: partial.email ?? "test@local",
    role: partial.role,
    tenantId: partial.tenantId,
    branchIds: partial.branchIds ?? [],
  };
}

describe("akademik yıl", () => {
  it("başlangıç bitişten önce olmalı", () => {
    expect(() => validateAcademicRange(new Date("2027-06-15"), new Date("2026-09-01"))).toThrow(
      /önce/,
    );
  });
});

describe("okul yapısı izolasyonu", () => {
  const suffix = `t${Date.now()}`;

  it("başka tenant şubesini güncelleyemez, veli bağlar, program çakışmasını reddeder", async () => {
    const hash = await bcrypt.hash("Demo123!", 10);
    const a = await prisma.tenant.create({
      data: {
        name: `OrgTest A ${suffix}`,
        academicYearStart: new Date("2026-09-01"),
        academicYearEnd: new Date("2027-06-15"),
        workStart: "08:00",
        workEnd: "18:00",
      },
    });
    const b = await prisma.tenant.create({
      data: {
        name: `OrgTest B ${suffix}`,
        academicYearStart: new Date("2026-09-01"),
        academicYearEnd: new Date("2027-06-15"),
        workStart: "08:00",
        workEnd: "18:00",
      },
    });
    const userA = await prisma.user.create({
      data: {
        tenantId: a.id,
        name: "Owner A",
        email: `ownera-${suffix}@x.local`,
        passwordHash: hash,
        role: "TENANT_OWNER",
      },
    });
    const userB = await prisma.user.create({
      data: {
        tenantId: b.id,
        name: "Owner B",
        email: `ownerb-${suffix}@x.local`,
        passwordHash: hash,
        role: "TENANT_OWNER",
      },
    });
    const userM = await prisma.user.create({
      data: {
        tenantId: a.id,
        name: "Manager A",
        email: `manager-${suffix}@x.local`,
        passwordHash: hash,
        role: "BRANCH_MANAGER",
      },
    });
    const ownerA = actor({ id: userA.id, role: "TENANT_OWNER", tenantId: a.id });
    const ownerB = actor({ id: userB.id, role: "TENANT_OWNER", tenantId: b.id });
    const manager = actor({
      id: userM.id,
      role: "BRANCH_MANAGER",
      tenantId: a.id,
      branchIds: [],
    });

    const branchA = await upsertBranch(ownerA, {
      name: "Test Şube A",
      code: `TA-${suffix.slice(-6)}`,
      address: "Test Mahallesi Cadde No:10",
      city: "Ankara",
      district: "Çankaya",
    });
    const branchB = await upsertBranch(ownerB, {
      name: "Test Şube B",
      code: `TB-${suffix.slice(-6)}`,
      address: "Test Mahallesi Cadde No:11",
      city: "İstanbul",
      district: "Kadıköy",
    });

    await expect(
      upsertBranch(ownerA, {
        id: branchB.id,
        name: "Çalınan şube",
        code: "HACK",
        address: "Test Mahallesi Cadde No:99",
        city: "Ankara",
        district: "Çankaya",
      }),
    ).rejects.toThrow(/Tenant/);

    await expect(
      upsertUser(manager, {
        name: "Kaçak Sahip",
        email: `hack-${suffix}@x.local`,
        role: "TENANT_OWNER",
        branchIds: [],
      }),
    ).rejects.toThrow(/rolü/);

    const loc = await upsertLocation(ownerA, {
      branchId: branchA.id,
      name: `Kapı ${suffix}`,
      type: "CLASSROOM",
      building: "Bina T",
    });
    const classroom = await upsertClassroom(ownerA, {
      branchId: branchA.id,
      gradeLevel: "11",
      section: "C",
      locationId: loc.id,
    });
    expect(classroom.name).toBe("11-C");
    expect(classroom.band).toBe("LISE");

    const course = await upsertCourse(ownerA, {
      name: "Tarih",
      subject: "Sözel",
      code: `TAR${suffix.slice(-4)}`,
      durationMinutes: 40,
      attendanceType: "LESSON",
    });
    const teacher = await prisma.user.create({
      data: {
        tenantId: a.id,
        name: "Öğretmen T",
        email: `ogrt-${suffix}@x.local`,
        passwordHash: hash,
        role: "TEACHER",
        scopes: { create: [{ branchId: branchA.id }] },
      },
    });
    await upsertSchedule(ownerA, {
      branchId: branchA.id,
      classroomId: classroom.id,
      courseId: course.id,
      teacherId: teacher.id,
      locationId: loc.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "09:40",
    });
    await expect(
      upsertSchedule(ownerA, {
        branchId: branchA.id,
        classroomId: classroom.id,
        courseId: course.id,
        teacherId: teacher.id,
        locationId: loc.id,
        dayOfWeek: 1,
        startTime: "09:20",
        endTime: "10:00",
      }),
    ).rejects.toThrow(/çakışma/);

    const loc2 = await upsertLocation(ownerA, {
      branchId: branchA.id,
      name: `Kapı2 ${suffix}`,
      type: "CLASSROOM",
    });
    const classroom2 = await upsertClassroom(ownerA, {
      branchId: branchA.id,
      gradeLevel: "10",
      section: "D",
      locationId: loc2.id,
    });
    await expect(
      upsertSchedule(ownerA, {
        branchId: branchA.id,
        classroomId: classroom2.id,
        courseId: course.id,
        teacherId: teacher.id,
        locationId: loc2.id,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "09:40",
      }),
    ).rejects.toThrow(/öğretmen/);

    const student = await upsertStudent(ownerA, {
      branchId: branchA.id,
      classroomId: classroom.id,
      studentNo: `NO${suffix.slice(-6)}`,
      name: "Deneme Öğrenci",
    });
    await expect(
      linkParent(ownerA, {
        studentId: student.id,
        name: "Deneme Veli",
        email: `veli-${suffix}@x.local`,
        phone: "+905551112233",
        kvkkConsent: false,
      }),
    ).rejects.toThrow(/KVKK/);
    const link = await linkParent(ownerA, {
      studentId: student.id,
      name: "Deneme Veli",
      email: `veli-${suffix}@x.local`,
      phone: "+905551112233",
      kvkkConsent: true,
    });
    expect(link.kvkkConsent).toBe(true);

    await expect(
      createTenant(ownerA, {
        name: "Kaçak tenant",
        academicYearStart: "2026-09-01",
        academicYearEnd: "2027-06-15",
      }),
    ).rejects.toThrow(/Yetkisiz/);

    await prisma.notificationPreference.deleteMany({ where: { studentId: student.id } });
    await prisma.parentStudent.deleteMany({ where: { studentId: student.id } });
    await prisma.student.delete({ where: { id: student.id } });
    await prisma.lessonSchedule.deleteMany({ where: { tenantId: a.id } });
    await prisma.course.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.classroom.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.location.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.building.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.userBranchScope.deleteMany({
      where: { user: { tenantId: { in: [a.id, b.id] } } },
    });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.branch.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
