import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveTopicAction } from "@/app/sis-actions";

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.lessonTopic.findMany({
    where: tenantFilter(actor),
    include: { course: true, teacher: true },
    orderBy: { weekOf: "desc" },
  });
  return (
    <div>
      <PageHeader title="Konu / müfredat" subtitle="Dijital sınıf defteri: haftalık kazanımlar, öğretmen portalından." />
      <Flash ok={sp.ok} err={sp.err} />
      {actor.role !== "STUDENT" && actor.role !== "PARENT" ? (
        <form action={saveTopicAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="courseId" required>{lookups.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="input" name="weekOf" type="date" required />
          <input className="input md:col-span-2" name="title" placeholder="Konu başlığı" required />
          <textarea className="textarea md:col-span-2" name="outcomes" placeholder="Kazanımlar" required />
          <button className="btn btn-primary">Ekle</button>
        </form>
      ) : null}
      <div className="space-y-3">
        {items.map((t) => (
          <article key={t.id} className="card p-5">
            <h2 className="font-semibold">{t.title}</h2>
            <p className="text-sm text-slate-500">{t.course.name} · {t.teacher.name} · {t.weekOf}</p>
            <p className="text-sm mt-2">{t.outcomes}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
