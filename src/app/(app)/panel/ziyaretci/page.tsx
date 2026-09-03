import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveVisitorAction } from "@/app/sis-actions";
import { formatTrDateTime } from "@/lib/time";

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.visitorLog.findMany({
    where: tenantFilter(actor),
    include: { host: true, branch: true },
    orderBy: { arrivedAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Ziyaretçi" subtitle="Kim geldi, kime, ne zaman, hangi konuda." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveVisitorAction} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
        <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input className="input" name="visitorName" placeholder="Ziyaretçi" required />
        <input className="input" name="purpose" placeholder="Amaç" required />
        <button className="btn btn-primary">Giriş kaydı</button>
      </form>
      <table className="table card">
        <thead><tr><th>Ziyaretçi</th><th>Amaç</th><th>Ev sahibi</th><th>Şube</th><th>Giriş</th></tr></thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td>{v.visitorName}</td>
              <td>{v.purpose}</td>
              <td>{v.host.name}</td>
              <td>{v.branch.name}</td>
              <td>{formatTrDateTime(v.arrivedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
