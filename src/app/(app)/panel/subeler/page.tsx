import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { saveBranch } from "@/app/actions";
import { canManageBranches } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { Flash, NeedTenant } from "@/components/flash";
import Link from "next/link";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const branches = await scopedBranches(actor);
  const canEdit = canManageBranches(actor.role);
  return (
    <div>
      <PageHeader title="Şubeler" subtitle="Şube adı, kod, adres, il/ilçe, zaman dilimi. Firma katmanında yönetilir." />
      <Flash ok={sp.ok} err={sp.err} />
      {canEdit ? (
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
      ) : (
        <p className="text-sm text-slate-500 mb-4">Şube ekleme yetkisi firma sahibi / operasyondadır.</p>
      )}
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
