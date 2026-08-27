import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { FileLink } from "@/components/sis-ui";
import { canAccessMaterial, requireOwnStudent } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function StudentMaterials() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const candidates = await prisma.material.findMany({
    where: { tenantId: student.tenantId, visibility: { not: "PRIVATE" } },
    include: { teacher: true },
    orderBy: { createdAt: "desc" },
  });
  const rows = [];
  for (const m of candidates) {
    if (await canAccessMaterial(actor, m.id)) rows.push(m);
  }
  return (
    <div>
      <PageHeader title="Materyaller" subtitle="Sizinle paylaşılan dosyalar." />
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
