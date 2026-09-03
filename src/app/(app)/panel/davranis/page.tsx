import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveBehaviorAction } from "@/app/sis-actions";
import { formatTrDateTime } from "@/lib/time";
import { Pill } from "@/components/sis-ui";

export default async function BehaviorPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.behaviorRecord.findMany({
    where: tenantFilter(actor),
    include: { student: true, author: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Davranış" subtitle="Olumlu / olumsuz / disiplin puanı. Gelişim karnesine temel." />
      <Flash ok={sp.ok} err={sp.err} />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveBehaviorAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="select" name="kind"><option value="POSITIVE">Olumlu</option><option value="NEGATIVE">Olumsuz</option><option value="DISCIPLINE">Disiplin</option></select>
          <input className="input" name="points" type="number" defaultValue={1} />
          <input className="input md:col-span-2" name="title" placeholder="Başlık" required />
          <textarea className="textarea md:col-span-2" name="note" placeholder="Gözlem" required />
          <button className="btn btn-primary">Kaydet</button>
        </form>
      )}
      <div className="space-y-3">
        {items.map((b) => (
          <article key={b.id} className="card p-5">
            <div className="flex gap-2 items-center">
              <Pill tone={b.kind === "POSITIVE" ? "teal" : b.kind === "NEGATIVE" ? "orange" : "rose"}>{b.kind} {b.points}</Pill>
              <span className="font-semibold">{b.student.name}</span>
            </div>
            <p className="text-sm mt-1">{b.title} — {b.note}</p>
            <p className="text-xs text-slate-500 mt-1">{b.author.name} · {formatTrDateTime(b.createdAt)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
