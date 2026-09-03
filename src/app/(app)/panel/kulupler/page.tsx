import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { joinClubAction, saveClubAction } from "@/app/sis-actions";

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const clubs = await prisma.club.findMany({
    where: tenantFilter(actor),
    include: { members: { include: { student: true } }, branch: true },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Kulüpler" subtitle="Tercih + yerleştirme. Kapasite dolunca yeni üye alınmaz." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <form action={saveClubAction} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input className="input" name="name" placeholder="Satranç" required />
          <input className="input" name="capacity" type="number" defaultValue={20} />
          <button className="btn btn-primary">Kulüp oluştur</button>
        </form>
      ) : null}
      <div className="grid md:grid-cols-2 gap-4">
        {clubs.map((c) => (
          <article key={c.id} className="card p-5">
            <h2 className="font-semibold">{c.name}</h2>
            <p className="text-sm text-slate-500">{c.branch.name} · {c.members.length}/{c.capacity}</p>
            <ul className="text-sm mt-2 space-y-1">{c.members.map((m) => <li key={m.id}>{m.student.name} (tercih {m.preference})</li>)}</ul>
            {write || actor.role === "STUDENT" ? (
              <form action={joinClubAction} className="mt-3 grid gap-2">
                <input type="hidden" name="clubId" value={c.id} />
                {actor.role === "STUDENT" && actor.studentId ? (
                  <input type="hidden" name="studentId" value={actor.studentId} />
                ) : (
                  <select className="select" name="studentId">{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                )}
                <input className="input" name="preference" type="number" defaultValue={1} min={1} max={4} />
                <button className="btn btn-ghost">Yerleştir</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
