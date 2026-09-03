import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveMealAction } from "@/app/sis-actions";

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.mealMenu.findMany({ where: tenantFilter(actor), include: { branch: true }, orderBy: { date: "desc" } });
  return (
    <div>
      <PageHeader title="Yemekhane" subtitle="Günlük / haftalık menü. Veli ve öğrenci portallarında görünür." />
      <Flash ok={sp.ok} err={sp.err} />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveMealAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input className="input" name="date" type="date" required />
          <select className="select" name="meal"><option>Öğle</option><option>Kahvaltı</option><option>İkindi</option></select>
          <input className="input" name="items" placeholder="Çorba, ızgara, salata, meyve" required />
          <button className="btn btn-primary">Menü ekle</button>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((m) => (
          <article key={m.id} className="card p-5">
            <div className="text-xs text-slate-500">{m.date} · {m.meal} · {m.branch.name}</div>
            <p className="font-medium mt-1">{m.items}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
