import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { requestMeetingAction, setMeetingAction } from "@/app/sis-actions";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.parentMeeting.findMany({
    where: tenantFilter(actor),
    include: { teacher: true, student: true },
    orderBy: { slot: "asc" },
  });
  return (
    <div>
      <PageHeader title="Öğretmen–veli randevu" subtitle="Yüz yüze veya online slot; talep, onay, iptal." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={requestMeetingAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
        <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="select" name="teacherId" required>{lookups.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input className="input" name="parentName" placeholder="Veli adı" defaultValue={actor.role === "PARENT" ? actor.name : ""} />
        <input className="input" name="slot" placeholder="2026-09-08 16:30" required />
        <select className="select" name="mode"><option value="YUZ_YUZE">Yüz yüze</option><option value="ONLINE">Online</option></select>
        <input className="input md:col-span-2" name="note" placeholder="Not" />
        <button className="btn btn-primary">Randevu iste</button>
      </form>
      <div className="space-y-3">
        {items.map((m) => (
          <article key={m.id} className="card p-5 flex flex-wrap justify-between gap-3">
            <div>
              <div className="font-semibold">{m.student.name} · {m.teacher.name}</div>
              <p className="text-sm text-slate-500">{m.slot} · {m.mode} · {m.status} · {m.parentName}</p>
            </div>
            {actor.role !== "PARENT" && actor.role !== "STUDENT" ? (
              <form action={setMeetingAction} className="flex gap-2">
                <input type="hidden" name="id" value={m.id} />
                <select className="select" name="status" defaultValue={m.status}>
                  <option value="REQUESTED">Talep</option>
                  <option value="CONFIRMED">Onay</option>
                  <option value="CANCELLED">İptal</option>
                  <option value="DONE">Bitti</option>
                </select>
                <button className="btn btn-ghost">Güncelle</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
