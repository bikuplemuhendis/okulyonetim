import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { ChildSwitcher, FileLink } from "@/components/sis-ui";
import { canAccessMaterial, parentStudents } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function ParentMaterials({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await parentStudents(actor);
  const sp = await searchParams;
  const student = links.find((l) => l.studentId === sp.child)?.student ?? links[0]?.student;
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const candidates = await prisma.material.findMany({
    where: { tenantId: student.tenantId, visibility: { not: "PRIVATE" } },
    include: { teacher: true, classroom: true, course: true },
    orderBy: { createdAt: "desc" },
  });
  const rows = [];
  for (const m of candidates) {
    if (await canAccessMaterial(actor, m.id)) rows.push(m);
  }
  return (
    <div>
      <PageHeader title="Materyaller" subtitle={`${student.name} ile paylaşılan eğitim içerikleri.`} />
      <ChildSwitcher items={links.map((l) => ({ id: l.studentId, name: l.student.name }))} currentId={student.id} />
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="card p-4">
            <div className="font-medium">{r.title}</div>
            <p className="text-sm text-slate-600">{r.description}</p>
            <p className="text-xs text-slate-500">
              {r.teacher.name} · {formatTrDateTime(r.createdAt)}
            </p>
            <FileLink id={r.id} label={r.fileName} />
          </article>
        ))}
      </div>
    </div>
  );
}
