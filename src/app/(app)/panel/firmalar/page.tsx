import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, dateInputValue } from "@/components/flash";
import { saveTenant, saveTenantStatus } from "@/app/actions";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  if (actor.role !== "PLATFORM_SUPER_ADMIN") return <p>Yalnızca platform süper admin.</p>;
  const sp = await searchParams;
  const tenants = await prisma.tenant.findMany({
    include: { _count: { select: { branches: true, users: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader
        title="Firmalar (tenant)"
        subtitle="Tenant açma/kapama, akademik yıl ve ilk firma sahibi hesabı. Lisanslama V1’de durum alanıdır."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveTenant} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        <input className="input" name="name" placeholder="Firma adı" required minLength={2} />
        <input className="input" name="academicYearStart" type="date" defaultValue="2026-09-01" required />
        <input className="input" name="academicYearEnd" type="date" defaultValue="2027-06-15" required />
        <input className="input" name="ownerName" placeholder="Sahip adı (ops.)" />
        <input className="input" name="ownerEmail" type="email" placeholder="Sahip e-posta (ops.)" />
        <input className="input" name="ownerPassword" type="password" placeholder="Sahip parola (boşsa Demo123!)" />
        <select className="select" name="vertical" defaultValue="KAMPUS">
          <option value="KAMPUS">Kampüs (K-12)</option>
          <option value="NIDO">Nido (anaokulu / kreş)</option>
          <option value="KURS">Kurs (dershane)</option>
        </select>
        <button className="btn btn-primary">Tenant aç ve seç</button>
      </form>
      <NeedTenantNote />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Dikey</th>
              <th>Akademik yıl</th>
              <th>Şube</th>
              <th>Kullanıcı</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.vertical}</td>
                <td>
                  {dateInputValue(t.academicYearStart)} → {dateInputValue(t.academicYearEnd)}
                </td>
                <td>{t._count.branches}</td>
                <td>{t._count.users}</td>
                <td>
                  <form action={saveTenantStatus} className="flex gap-2 items-center">
                    <input type="hidden" name="id" value={t.id} />
                    <select className="select" name="status" defaultValue={t.status}>
                      <option value="ACTIVE">Aktif</option>
                      <option value="PASSIVE">Pasif</option>
                      <option value="SUSPENDED">Askıda</option>
                    </select>
                    <button className="btn btn-ghost">Kaydet</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NeedTenantNote() {
  return (
    <p className="text-sm text-slate-600 mb-4">
      Oluşturulan firma otomatik seçilir. Üst menüdeki Firma seçici ile başka tenanta geçebilirsiniz.
    </p>
  );
}
