import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveEventAction } from "@/app/sis-actions";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const events = await prisma.calendarEvent.findMany({ where: tenantFilter(actor), include: { branch: true }, orderBy: { startsOn: "asc" } });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Ajanda" subtitle="Etkinlik, özel gün, veli-öğretmen paylaşımı." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <form action={saveEventAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="branchId"><option value="">Tüm şubeler</option>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input className="input" name="title" placeholder="Başlık" required />
          <textarea className="textarea md:col-span-2" name="body" placeholder="Açıklama" required />
          <input className="input" name="startsOn" type="date" required />
          <input className="input" name="endsOn" type="date" required />
          <button className="btn btn-primary">Ekle</button>
        </form>
      ) : null}
      <div className="space-y-3">
        {events.map((e) => (
          <article key={e.id} className="card p-5">
            <div className="text-xs text-slate-500">{e.startsOn} → {e.endsOn} · {e.branch?.name ?? "Kurum"}</div>
            <h2 className="font-semibold">{e.title}</h2>
            <p className="text-sm mt-1">{e.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
