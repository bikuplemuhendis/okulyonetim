import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { savePickupAction } from "@/app/care-actions";

export default async function PickupPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const rows = await prisma.pickupContact.findMany({
    where: tenantFilter(actor),
    include: { student: true },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader title="Teslim kişileri" subtitle="Çocuğu kim alabilir? Anaokulu/kreş kapısında yetkisiz teslimi keser." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={savePickupAction} className="card p-5 grid md:grid-cols-4 gap-3 mb-6">
        <select className="select" name="studentId" required>
          {lookups.students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input className="input" name="name" placeholder="Ad" required />
        <input className="input" name="phone" placeholder="Telefon" required />
        <input className="input" name="relation" placeholder="Anne / baba / dede" required />
        <button className="btn btn-primary md:col-span-4">Ekle</button>
      </form>
      <table className="table card">
        <thead>
          <tr>
            <th>Çocuk</th>
            <th>Kişi</th>
            <th>Yakınlık</th>
            <th>Telefon</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.student.name}</td>
              <td>{r.name}</td>
              <td>{r.relation}</td>
              <td>{r.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
