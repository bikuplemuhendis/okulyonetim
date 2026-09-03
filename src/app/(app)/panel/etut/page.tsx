import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { bookTutoringAction, saveTutoringAction } from "@/app/sis-actions";

export default async function TutoringPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const slots = await prisma.tutoringSlot.findMany({
    where: tenantFilter(actor),
    include: { course: true, teacher: true, student: true },
    orderBy: { date: "desc" },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  const studentId = actor.studentId ?? lookups.students[0]?.id;
  return (
    <div>
      <PageHeader title="Etüt" subtitle="Açık slot, öğretmen ataması veya öğrenci talebi — kazanım etüdü için hazır." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <form action={saveTutoringAction} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="select" name="courseId" required>{lookups.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="input" name="date" type="date" required />
          <input className="input" name="startTime" placeholder="16:00" required />
          <input className="input" name="endTime" placeholder="16:40" required />
          <input className="input" name="topic" placeholder="Konu" required />
          <button className="btn btn-primary">Slot aç</button>
        </form>
      ) : null}
      <div className="space-y-3">
        {slots.map((s) => (
          <article key={s.id} className="card p-5 flex flex-wrap justify-between gap-3">
            <div>
              <div className="font-semibold">{s.topic}</div>
              <p className="text-sm text-slate-500">{s.course.name} · {s.teacher.name} · {s.date} {s.startTime}-{s.endTime} · {s.status}</p>
              {s.student ? <p className="text-sm mt-1">{s.student.name}</p> : null}
            </div>
            {s.status === "OPEN" && studentId ? (
              <form action={bookTutoringAction}>
                <input type="hidden" name="slotId" value={s.id} />
                {actor.role === "STUDENT" ? (
                  <input type="hidden" name="studentId" value={studentId} />
                ) : (
                  <select className="select mb-2" name="studentId" defaultValue={lookups.students[0]?.id}>
                    {lookups.students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                )}
                <button className="btn btn-primary">Rezerve et</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
