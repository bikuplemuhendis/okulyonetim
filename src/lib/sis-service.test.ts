import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Actor } from "./types";
import {
  canAccessMaterial,
  generateReportCards,
  listTeacherNotes,
  recordPayment,
  studentCourseAverage,
  upsertExam,
  upsertExamScore,
  upsertFeeType,
  upsertInvoice,
  upsertTeacherNote,
  upsertTerm,
} from "./sis-service";
import { invoiceBalance } from "./sis";

function actor(partial: Partial<Actor> & Pick<Actor, "id" | "role" | "tenantId">): Actor {
  return {
    id: partial.id,
    name: partial.name ?? "Test",
    email: partial.email ?? "test@local",
    role: partial.role,
    tenantId: partial.tenantId,
    branchIds: partial.branchIds ?? [],
    studentId: partial.studentId ?? null,
  };
}

describe("SIS çekirdek kuralları", () => {
  const suffix = `sis${Date.now()}`;

  it("not, sınav, ücret ve erişim kurallarını uygular", async () => {
    const hash = await bcrypt.hash("Demo123!", 10);
    const tenant = await prisma.tenant.create({
      data: {
        name: `SIS ${suffix}`,
        academicYearStart: new Date("2026-09-01"),
        academicYearEnd: new Date("2027-06-15"),
        workStart: "08:00",
        workEnd: "18:00",
      },
    });
    const tenantB = await prisma.tenant.create({
      data: {
        name: `SIS B ${suffix}`,
        academicYearStart: new Date("2026-09-01"),
        academicYearEnd: new Date("2027-06-15"),
        workStart: "08:00",
        workEnd: "18:00",
      },
    });
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "SIS Şube",
        code: `S${suffix.slice(-6)}`,
        address: "Test Mahallesi Cadde No:20",
        city: "Ankara",
        district: "Çankaya",
      },
    });
    const owner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Sahip",
        email: `sis-own-${suffix}@x.local`,
        passwordHash: hash,
        role: "TENANT_OWNER",
      },
    });
    const teacherA = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Öğretmen A",
        email: `sis-ta-${suffix}@x.local`,
        passwordHash: hash,
        role: "TEACHER",
        scopes: { create: [{ branchId: branch.id }] },
      },
    });
    const teacherB = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Öğretmen B",
        email: `sis-tb-${suffix}@x.local`,
        passwordHash: hash,
        role: "TEACHER",
        scopes: { create: [{ branchId: branch.id }] },
      },
    });
    const parent = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Veli",
        email: `sis-p-${suffix}@x.local`,
        passwordHash: hash,
        role: "PARENT",
        scopes: { create: [{ branchId: branch.id }] },
      },
    });
    const loc = await prisma.location.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: `Kapı ${suffix}`,
        type: "CLASSROOM",
      },
    });
    const classroom = await prisma.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: "10-Z",
        gradeLevel: "10",
        section: "Z",
        band: "LISE",
        locationId: loc.id,
      },
    });
    const course = await prisma.course.create({
      data: {
        tenantId: tenant.id,
        name: "Geometri",
        subject: "Sayısal",
        code: `GEO${suffix.slice(-4)}`,
        durationMinutes: 40,
      },
    });
    await prisma.lessonSchedule.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        classroomId: classroom.id,
        courseId: course.id,
        teacherId: teacherA.id,
        locationId: loc.id,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "08:40",
      },
    });
    const student = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        classroomId: classroom.id,
        studentNo: `S${suffix.slice(-6)}`,
        name: "Ayşe Öğrenci",
      },
    });
    await prisma.parentStudent.create({
      data: { parentId: parent.id, studentId: student.id, kvkkConsent: true },
    });

    const ownerActor = actor({ id: owner.id, role: "TENANT_OWNER", tenantId: tenant.id });
    const teacherActor = actor({
      id: teacherA.id,
      role: "TEACHER",
      tenantId: tenant.id,
      branchIds: [branch.id],
    });
    const teacherBActor = actor({
      id: teacherB.id,
      role: "TEACHER",
      tenantId: tenant.id,
      branchIds: [branch.id],
    });
    const parentActor = actor({
      id: parent.id,
      role: "PARENT",
      tenantId: tenant.id,
      branchIds: [branch.id],
    });
    const otherOwner = actor({
      id: "other",
      role: "TENANT_OWNER",
      tenantId: tenantB.id,
    });

    const term = await upsertTerm(ownerActor, {
      name: "1. Dönem",
      startDate: "2026-09-01",
      endDate: "2027-01-20",
      isCurrent: true,
    });

    await expect(
      upsertExam(teacherBActor, {
        termId: term.id,
        branchId: branch.id,
        courseId: course.id,
        classroomId: classroom.id,
        name: "Kaçak sınav",
        examDate: "2026-11-10",
      }),
    ).rejects.toThrow(/programınızda/);

    const exam = await upsertExam(teacherActor, {
      termId: term.id,
      branchId: branch.id,
      courseId: course.id,
      classroomId: classroom.id,
      name: "1. Yazılı",
      examDate: "2026-11-10",
      maxScore: 100,
      weight: 2,
      published: true,
    });

    await expect(upsertExamScore(teacherActor, { examId: exam.id, studentId: student.id, score: 140 })).rejects.toThrow(
      /arasında/,
    );
    await upsertExamScore(teacherActor, { examId: exam.id, studentId: student.id, score: 80 });
    const avg = await studentCourseAverage({
      studentId: student.id,
      courseId: course.id,
      termId: term.id,
      publishedOnly: true,
    });
    expect(avg).toBe(80);

    const cards = await generateReportCards(ownerActor, term.id, classroom.id);
    expect(cards.length).toBe(1);
    const line = await prisma.reportCardLine.findFirst({ where: { reportCardId: cards[0].id } });
    expect(line?.letter).toBe("BB");
    expect(line?.fivePoint).toBe(4);

    const fee = await upsertFeeType(ownerActor, { name: "Eğitim", amount: 1000, period: "TERM" });
    const invoice = await upsertInvoice(ownerActor, {
      studentId: student.id,
      feeTypeId: fee.id,
      title: "1. dönem eğitim",
      amount: 1000,
      dueDate: "2026-10-01",
    });
    await recordPayment(ownerActor, { invoiceId: invoice.id, amount: 400, method: "CASH" });
    await expect(recordPayment(ownerActor, { invoiceId: invoice.id, amount: 700 })).rejects.toThrow(/bakiyeyi/);
    const loaded = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { payments: true },
    });
    expect(loaded?.status).toBe("PARTIAL");
    expect(invoiceBalance(loaded!.amount, loaded!.payments)).toBe(600);

    await expect(
      upsertInvoice(otherOwner, {
        studentId: student.id,
        title: "Çalıntı",
        amount: 10,
        dueDate: "2026-10-01",
      }),
    ).rejects.toThrow(/Tenant/);

    const note = await upsertTeacherNote(teacherActor, { studentId: student.id, body: "Özel takip notu" });
    const visibleToA = await listTeacherNotes(teacherActor, student.id);
    expect(visibleToA.some((n) => n.id === note.id)).toBe(true);
    const visibleToB = await listTeacherNotes(teacherBActor, student.id);
    expect(visibleToB.some((n) => n.id === note.id)).toBe(false);

    const mat = await prisma.material.create({
      data: {
        tenantId: tenant.id,
        teacherId: teacherA.id,
        classroomId: classroom.id,
        branchId: branch.id,
        title: "Kitapçık",
        description: "deneme",
        fileName: "a.txt",
        storedName: "x.txt",
        mimeType: "text/plain",
        sizeBytes: 3,
        visibility: "CLASS",
      },
    });
    expect(await canAccessMaterial(parentActor, mat.id)).toBeTruthy();
    const stranger = actor({
      id: "px",
      role: "PARENT",
      tenantId: tenant.id,
      branchIds: [branch.id],
    });
    expect(await canAccessMaterial(stranger, mat.id)).toBeNull();

    await prisma.material.delete({ where: { id: mat.id } });
    await prisma.reportCard.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.examScore.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.exam.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.feeType.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.teacherNote.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.parentStudent.deleteMany({ where: { studentId: student.id } });
    await prisma.student.delete({ where: { id: student.id } });
    await prisma.lessonSchedule.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.academicTerm.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.course.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.classroom.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.location.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.userBranchScope.deleteMany({ where: { user: { tenantId: { in: [tenant.id, tenantB.id] } } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [tenant.id, tenantB.id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenant.id, tenantB.id] } } });
    await prisma.branch.deleteMany({ where: { tenantId: { in: [tenant.id, tenantB.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenant.id, tenantB.id] } } });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
