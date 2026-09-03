import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { assignBusAction, saveBusRouteAction } from "@/app/sis-actions";

export default async function BusPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const routes = await prisma.busRoute.findMany({
    where: tenantFilter(actor),
    include: { assignments: { include: { student: true } }, branch: true },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Öğrenci servisleri" subtitle="Araç, güzergâh, durak ve veliye görünen sabah saati." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <form action={saveBusRouteAction} className="card p-5 grid gap-3">
            <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <input className="input" name="name" placeholder="Güzergâh adı" required />
            <input className="input" name="vehicle" placeholder="Minibüs" required />
            <input className="input" name="driver" placeholder="Şoför" required />
            <input className="input" name="plate" placeholder="06 KT 123" required />
            <input className="input" name="morningEta" placeholder="07:40" required />
            <button className="btn btn-primary">Güzergâh ekle</button>
          </form>
          <form action={assignBusAction} className="card p-5 grid gap-3">
            <select className="select" name="routeId" required>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <input className="input" name="stopName" placeholder="Durak" required />
            <button className="btn btn-primary">Öğrenci bağla</button>
          </form>
        </div>
      ) : null}
      <div className="space-y-3">
        {routes.map((r) => (
          <article key={r.id} className="card p-5">
            <h2 className="font-semibold">{r.name}</h2>
            <p className="text-sm text-slate-500">{r.vehicle} · {r.plate} · {r.driver} · sabah {r.morningEta} · {r.branch.name}</p>
            <ul className="text-sm mt-2">{r.assignments.map((a) => <li key={a.id}>{a.student.name} — {a.stopName}</li>)}</ul>
          </article>
        ))}
      </div>
    </div>
  );
}
