import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveAchievementAction } from "@/app/sis-actions";

export default async function AchievementsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.achievement.findMany({ where: tenantFilter(actor), include: { student: true }, orderBy: { awardedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Başarılarım" subtitle="Rozet, kupa, okul içi/dışı başarı." />
      <Flash ok={sp.ok} err={sp.err} />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveAchievementAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className="input" name="badge" placeholder="Rozet (ör. altın)" required />
          <input className="input md:col-span-2" name="title" placeholder="Başlık" required />
          <input className="input md:col-span-2" name="note" placeholder="Not" required />
          <button className="btn btn-primary">Ver</button>
        </form>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((a) => (
          <article key={a.id} className="card p-5">
            <div className="text-xs uppercase tracking-wide text-orange-700">{a.badge}</div>
            <h2 className="font-semibold">{a.title}</h2>
            <p className="text-sm">{a.student.name} — {a.note}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
