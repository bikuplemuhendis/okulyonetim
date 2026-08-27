import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/uploads";
import { canAccessMaterial, parentStudents } from "@/lib/sis-service";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const { id } = await ctx.params;
  const material = await canAccessMaterial(actor, id);
  if (material) {
    try {
      const buf = await readStored(material.storedName);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": material.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(material.fileName)}"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Dosya yok" }, { status: 404 });
    }
  }
  const sub = await prisma.assignmentSubmission.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (sub?.storedName) {
    const allowed =
      actor.role === "STUDENT"
        ? actor.studentId === sub.studentId
        : actor.role === "PARENT"
          ? (await parentStudents(actor)).some((l) => l.studentId === sub.studentId)
          : actor.role === "TEACHER"
            ? sub.assignment.teacherId === actor.id
            : ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER", "BRANCH_OPS"].includes(
                actor.role,
              );
    if (!allowed) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    try {
      const buf = await readStored(sub.storedName);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": sub.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(sub.fileName || "teslim")}"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Dosya yok" }, { status: 404 });
    }
  }
  return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
}
