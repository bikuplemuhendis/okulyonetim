import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveDutyAction } from "@/app/sis-actions";

export default async function DutyPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.dutyShift.findMany({
    where: actor.role === "TEACHER" ? { userId: actor.id } : tenantFilter(actor),
    include: { user: true, branch: true },
    orderBy: { date: "asc" },
  });
  return (
    <div>
      <PageHeader title="Nöbet" subtitle="Yer, saat, öğretmen. Öğretmen kendi nöbetlerini görür." />
      <Flash ok={sp.ok} err={sp.err} />
      {["TEACHER", "PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveDutyAction} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="select" name="userId" required>{lookups.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input className="input" name="date" type="date" required />
          <input className="input" name="slot" placeholder="Teneffüs 2" required />
          <input className="input" name="place" placeholder="Bahçe" required />
          <button className="btn btn-primary">Ata</button>
        </form>
      )}
      <table className="table card">
        <thead><tr><th>Tarih</th><th>Öğretmen</th><th>Slot</th><th>Yer</th><th>Şube</th></tr></thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}><td>{d.date}</td><td>{d.user.name}</td><td>{d.slot}</td><td>{d.place}</td><td>{d.branch.name}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
