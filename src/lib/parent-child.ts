import { prisma } from "./prisma";
import type { Actor } from "./types";

export async function parentChildren(actor: Actor, childId?: string) {
  const links = await prisma.parentStudent.findMany({
    where: { parentId: actor.id },
    include: { student: { include: { classroom: true, branch: true } } },
  });
  const student = links.find((l) => l.studentId === childId)?.student ?? links[0]?.student;
  return { links, student };
}
