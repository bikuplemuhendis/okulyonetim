import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveTenant } from "@/app/actions";

export default async function TenantsPage() {
  const actor = await requireActor();
  if (actor.role !== "PLATFORM_SUPER_ADMIN") return <p>Yalnızca platform süper admin.</p>;
  const tenants = await prisma.tenant.findMany({ include: { _count: { select: { branches: true, users: true } } } });
  return (
    <div>
      <PageHeader title="Firmalar (tenant)" subtitle="Lisanslama / tenant açma — platform katmanı." />
      <form action={saveTenant} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        <input className="input" name="name" placeholder="Firma adı" required />
        <input className="input" name="academicYearStart" type="date" defaultValue="2026-09-01" />
        <input className="input" name="academicYearEnd" type="date" defaultValue="2027-06-15" />
        <button className="btn btn-primary">Tenant aç</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Şube</th>
              <th>Kullanıcı</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t._count.branches}</td>
                <td>{t._count.users}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
