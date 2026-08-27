import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveBranch } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import Link from "next/link";

export default async function BranchesPage() {
  const actor = await requireActor();
  const branches = await prisma.branch.findMany({
    where: tenantFilter(actor),
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader title="Şubeler" subtitle="Şube tanımlama sihirbazı — temel bilgiler." />
      <form action={saveBranch} className="card p-5 mb-6 grid md:grid-cols-2 gap-3">
        <input className="input" name="name" placeholder="Şube adı" required minLength={2} />
        <input className="input" name="code" placeholder="Şube kodu (ANK-01)" required />
        <textarea className="textarea md:col-span-2" name="address" placeholder="Adres (min 10 karakter)" required minLength={10} />
        <input className="input" name="city" placeholder="İl" required />
        <input className="input" name="district" placeholder="İlçe" required />
        <input className="input" name="phone" placeholder="Telefon" />
        <input className="input" name="timezone" defaultValue="Europe/Istanbul" />
        <select className="select" name="status" defaultValue="ACTIVE">
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button className="btn btn-primary">Şube ekle</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Kod</th>
              <th>İl / İlçe</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link className="text-kampus-700 font-medium" href={`/panel/subeler/${b.id}`}>
                    {b.name}
                  </Link>
                </td>
                <td>{b.code}</td>
                <td>
                  {b.city} / {b.district}
                </td>
                <td>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
