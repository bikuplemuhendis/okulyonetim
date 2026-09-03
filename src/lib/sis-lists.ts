import { prisma } from "./prisma";
import type { Actor } from "./types";
import { tenantFilter } from "./rbac";
import { scopedBranches } from "./services";

export async function sisLookups(actor: Actor) {
  const branches = await scopedBranches(actor);
  const branchIds = branches.map((b) => b.id);
  const [courses, classrooms, students, teachers] = await Promise.all([
    prisma.course.findMany({ where: tenantFilter(actor), orderBy: { name: "asc" } }),
    prisma.classroom.findMany({
      where: branchIds.length ? { branchId: { in: branchIds } } : tenantFilter(actor),
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: {
        status: "ACTIVE",
        ...(branchIds.length ? { branchId: { in: branchIds } } : tenantFilter(actor)),
      },
      include: { classroom: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { role: "TEACHER", ...tenantFilter(actor) },
      orderBy: { name: "asc" },
    }),
  ]);
  return { branches, courses, classrooms, students, teachers };
}
