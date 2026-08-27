import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteBuildingAction, saveBuilding } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import Link from "next/link";

export default async function BuildingsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const branches = await scopedBranches(actor);
  const buildings = await prisma.building.findMany({
    where: { ...tenantFilter(actor), branchId: branches.length ? { in: branches.map((b) => b.id) } : undefined },
    include: { branch: true },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
  });
  const editing = buildings.find((b) => b.id === sp.edit);
  return (
    <div>
      <PageHeader
        title="Binalar / kampüs blokları"
        subtitle="Şube içindeki bina adları. Lokasyonlar bu listeye bağlanır; kat lokasyon formunda girilir."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveBuilding} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <select className="select" name="branchId" defaultValue={editing?.branchId} required>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input className="input" name="name" placeholder="Bina adı" required defaultValue={editing?.name ?? ""} />
        <select className="select" name="status" defaultValue={editing?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button className="btn btn-primary">{editing ? "Güncelle" : "Bina ekle"}</button>
        {editing ? (
          <Link className="btn btn-ghost" href="/panel/binalar">
            Vazgeç
          </Link>
        ) : null}
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Bina</th>
              <th>Şube</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.branch.name}</td>
                <td>{b.status}</td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/binalar?edit=${b.id}`}>
                    Düzenle
                  </Link>
                  <ConfirmDelete action={deleteBuildingAction} id={b.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
