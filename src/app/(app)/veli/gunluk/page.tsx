import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";

export default async function ParentDaily({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const { student } = await parentChildren(actor, (await searchParams).child);
  if (!student) return <p>Bağlı çocuk yok.</p>;
  const reports = await prisma.dailyReport.findMany({
    where: { studentId: student.id, sharedWithParent: true },
    include: { author: true },
    orderBy: { date: "desc" },
    take: 20,
  });
  return (
    <div>
      <PageHeader title="Günlük rapor" subtitle={`${student.name} — bugün yuva nasıl geçti?`} />
      <div className="space-y-3">
        {reports.map((r) => (
          <article key={r.id} className="card p-5">
            <div className="text-xs text-slate-500">
              {r.date} · {r.author.name}
            </div>
            <p className="mt-1 font-medium">{r.mood}</p>
            <p className="text-sm mt-1">Öğün: {r.meals}</p>
            <p className="text-sm">Uyku: {r.sleepMinutes} dk · {r.toilet}</p>
            <p className="text-sm mt-1">{r.activities}</p>
            {r.photoNote ? <p className="text-sm text-kampus-700 mt-1">Foto: {r.photoNote}</p> : null}
            <p className="text-sm mt-2">{r.note}</p>
          </article>
        ))}
        {!reports.length ? <p className="text-sm text-slate-500">Henüz günlük yok.</p> : null}
      </div>
    </div>
  );
}
