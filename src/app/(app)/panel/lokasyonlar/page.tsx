import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteLocationAction, saveLocation } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import Link from "next/link";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const branches = await scopedBranches(actor);
  const locations = await prisma.location.findMany({
    where: { ...tenantFilter(actor), branchId: branches.length ? { in: branches.map((b) => b.id) } : undefined },
    include: { branch: true },
    orderBy: { name: "asc" },
  });
  const buildings = await prisma.building.findMany({
    where: { ...tenantFilter(actor), status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
  const editing = locations.find((l) => l.id === sp.edit);
  return (
    <div>
      <PageHeader
        title="Lokasyonlar (web check-in noktaları)"
        subtitle="RFID cihaz eşleştirme yok. Sınıf kapısı, turnike ve kütüphane web yoklama noktasıdır."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveLocation} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <select className="select" name="branchId" required defaultValue={editing?.branchId}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input className="input" name="name" placeholder="Lokasyon adı" required defaultValue={editing?.name ?? ""} />
        <select className="select" name="type" defaultValue={editing?.type ?? "CLASSROOM"}>
          <option value="CLASSROOM">Sınıf kapısı</option>
          <option value="GATE">Turnike / giriş-çıkış</option>
          <option value="LIBRARY">Kütüphane</option>
          <option value="OTHER">Diğer</option>
        </select>
        <input
          className="input"
          name="building"
          placeholder="Bina"
          defaultValue={editing?.building ?? ""}
          list="building-names"
        />
        <datalist id="building-names">
          {buildings.map((b) => (
            <option key={b.id} value={b.name} />
          ))}
        </datalist>
        <input className="input" name="floor" placeholder="Kat" defaultValue={editing?.floor ?? ""} />
        <input
          className="input"
          name="capacity"
          type="number"
          placeholder="Kapasite"
          defaultValue={editing?.capacity != null ? String(editing.capacity) : ""}
        />
        <select className="select" name="direction" defaultValue={editing?.direction ?? "BOTH"}>
          <option value="BOTH">Her ikisi</option>
          <option value="IN">Giriş</option>
          <option value="OUT">Çıkış</option>
        </select>
        <select className="select" name="status" defaultValue={editing?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
        {editing ? (
          <Link className="btn btn-ghost" href="/panel/lokasyonlar">
            Vazgeç
          </Link>
        ) : null}
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Şube</th>
              <th>Tip</th>
              <th>Bina / Kat</th>
              <th>Kiosk</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.branch.name}</td>
                <td>{l.type}</td>
                <td>
                  {l.building} {l.floor}
                </td>
                <td>
                  <Link className="text-kampus-700" href={`/kiosk/${l.id}`}>
                    Aç
                  </Link>
                </td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/lokasyonlar?edit=${l.id}`}>
                    Düzenle
                  </Link>
                  <ConfirmDelete action={deleteLocationAction} id={l.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
