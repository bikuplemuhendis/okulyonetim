import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveHomeworkAction } from "@/app/sis-actions";

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.homework.findMany({
    where: tenantFilter(actor),
    include: { course: true, classroom: true, teacher: true, submissions: { include: { student: true } } },
    orderBy: { createdAt: "desc" },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Ödevler" subtitle="Metin / dosya / link ödevi; veli ve öğrenci portallarında teslim durumu." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <form action={saveHomeworkAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="select" name="courseId" required>{lookups.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="select" name="classroomId" required>{lookups.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="select" name="kind"><option value="TEXT">Metin</option><option value="FILE">Dosya</option><option value="LINK">Bağlantı</option><option value="QUIZ">Online quiz</option></select>
          <input className="input md:col-span-2" name="title" placeholder="Başlık" required />
          <textarea className="textarea md:col-span-2" name="instructions" placeholder="Yönerge" required />
          <input className="input" name="dueDate" type="date" required />
          <button className="btn btn-primary">Ödev ata</button>
        </form>
      ) : null}
      <div className="space-y-3">
        {items.map((h) => (
          <article key={h.id} className="card p-5">
            <h2 className="font-semibold">{h.title}</h2>
            <p className="text-sm text-slate-500">{h.course.name} · {h.classroom.name} · {h.teacher.name} · son {h.dueDate}</p>
            <p className="text-sm mt-2">{h.instructions}</p>
            <p className="text-xs text-slate-500 mt-2">{h.submissions.filter((s) => s.status !== "ASSIGNED").length}/{h.submissions.length} teslim</p>
          </article>
        ))}
      </div>
    </div>
  );
}
