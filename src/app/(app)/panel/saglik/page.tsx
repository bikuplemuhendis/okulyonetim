import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveHealthAction } from "@/app/sis-actions";
import { formatTrDateTime } from "@/lib/time";

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.healthVisit.findMany({
    where: tenantFilter(actor),
    include: { student: true, staff: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Sağlık / revir" subtitle="Şikayet, tedavi, boy-kilo taraması." />
      <Flash ok={sp.ok} err={sp.err} />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveHealthAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className="input" name="complaint" placeholder="Şikayet" required />
          <input className="input" name="treatment" placeholder="Uygulama" required />
          <input className="input" name="heightCm" type="number" step="0.1" placeholder="Boy (cm)" />
          <input className="input" name="weightKg" type="number" step="0.1" placeholder="Kilo (kg)" />
          <button className="btn btn-primary">Revir kaydı</button>
        </form>
      )}
      <table className="table card">
        <thead><tr><th>Öğrenci</th><th>Şikayet</th><th>Tedavi</th><th>Ölçüm</th><th>Personel</th></tr></thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td>{v.student.name}</td>
              <td>{v.complaint}</td>
              <td>{v.treatment}</td>
              <td>{v.heightCm ? `${v.heightCm} cm` : "—"} {v.weightKg ? `/ ${v.weightKg} kg` : ""}</td>
              <td>{v.staff.name}<div className="text-xs text-slate-500">{formatTrDateTime(v.createdAt)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
