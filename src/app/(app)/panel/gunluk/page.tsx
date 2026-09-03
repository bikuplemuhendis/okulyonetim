import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveDailyReportAction } from "@/app/care-actions";
import { formatTrDateTime } from "@/lib/time";

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const reports = await prisma.dailyReport.findMany({
    where: tenantFilter(actor),
    include: { student: true, author: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 40,
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader
        title="Günlük rapor"
        subtitle="NidoKit karşılığı: ruh hali, öğün, uyku, tuvalet, etkinlik ve foto notu — veli aynı gün görür."
      />
      <Flash ok={sp.ok} err={sp.err} />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveDailyReportAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="studentId" required>
            {lookups.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.classroom.name}
              </option>
            ))}
          </select>
          <input className="input" name="date" type="date" defaultValue={today} required />
          <select className="select" name="mood">
            <option>Mutlu</option>
            <option>Sakin</option>
            <option>Yorgun</option>
            <option>Huysuz</option>
          </select>
          <input className="input" name="meals" placeholder="Öğün: kahvaltı+öğle yedi" required />
          <input className="input" name="sleepMinutes" type="number" placeholder="Uyku (dk)" defaultValue={40} />
          <input className="input" name="toilet" placeholder="Tuvalet / bez" required />
          <input className="input md:col-span-2" name="activities" placeholder="Etkinlikler" required />
          <input className="input md:col-span-2" name="photoNote" placeholder="Foto notu / galeri bağlantısı" />
          <textarea className="textarea md:col-span-2" name="note" placeholder="Veliye not" required />
          <button className="btn btn-primary">Günlüğü kaydet</button>
        </form>
      )}
      <div className="space-y-3">
        {reports.map((r) => (
          <article key={r.id} className="card p-5">
            <div className="text-xs text-slate-500">
              {r.date} · {r.student.name} · {r.author.name} · {formatTrDateTime(r.createdAt)}
            </div>
            <p className="mt-1 text-sm">
              Ruh hali <b>{r.mood}</b> · öğün {r.meals} · uyku {r.sleepMinutes} dk · {r.toilet}
            </p>
            <p className="text-sm mt-1">{r.activities}</p>
            {r.photoNote ? <p className="text-sm text-kampus-700 mt-1">Foto: {r.photoNote}</p> : null}
            <p className="text-sm mt-2">{r.note}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
