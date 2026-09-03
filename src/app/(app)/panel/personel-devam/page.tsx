import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveStaffAbsenceAction } from "@/app/sis-actions";

export default async function StaffAbsencePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const staff = await prisma.user.findMany({ where: { ...tenantFilter(actor), role: { notIn: ["PARENT", "STUDENT"] } } });
  const items = await prisma.staffAbsence.findMany({
    where: tenantFilter(actor),
    include: { user: true, branch: true },
    orderBy: { date: "desc" },
  });
  return (
    <div>
      <PageHeader title="Personel devam" subtitle="İzin, rapor, görev. Konum tabanlı otomatik yoklama sonraki faz." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveStaffAbsenceAction} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
        <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="select" name="userId" required>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <input className="input" name="date" type="date" required />
        <select className="select" name="kind"><option value="LEAVE">İzin</option><option value="SICK">Rapor</option><option value="DUTY">Görevli</option><option value="OTHER">Diğer</option></select>
        <input className="input md:col-span-2" name="note" placeholder="Not" />
        <button className="btn btn-primary">Kaydet</button>
      </form>
      <table className="table card">
        <thead><tr><th>Tarih</th><th>Personel</th><th>Tür</th><th>Not</th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}><td>{a.date}</td><td>{a.user.name}</td><td>{a.kind}</td><td>{a.note ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
