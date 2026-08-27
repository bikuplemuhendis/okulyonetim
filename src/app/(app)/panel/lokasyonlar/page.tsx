import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveLocation } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import Link from "next/link";

export default async function LocationsPage() {
  const actor = await requireActor();
  const branches = await scopedBranches(actor);
  const locations = await prisma.location.findMany({
    where: { ...tenantFilter(actor), branchId: branches.length ? { in: branches.map((b) => b.id) } : undefined },
    include: { branch: true },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader
        title="Lokasyonlar (web check-in noktaları)"
        subtitle="RFID cihaz eşleştirme yok. Sınıf kapısı, turnike ve kütüphane web yoklama noktasıdır."
      />
      <form action={saveLocation} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        <select className="select" name="branchId" required>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input className="input" name="name" placeholder="Lokasyon adı" required />
        <select className="select" name="type" defaultValue="CLASSROOM">
          <option value="CLASSROOM">Sınıf kapısı</option>
          <option value="GATE">Turnike / giriş-çıkış</option>
          <option value="LIBRARY">Kütüphane</option>
          <option value="OTHER">Diğer</option>
        </select>
        <input className="input" name="building" placeholder="Bina" />
        <input className="input" name="floor" placeholder="Kat" />
        <input className="input" name="capacity" type="number" placeholder="Kapasite" />
        <select className="select" name="direction" defaultValue="BOTH">
          <option value="BOTH">Her ikisi</option>
          <option value="IN">Giriş</option>
          <option value="OUT">Çıkış</option>
        </select>
        <select className="select" name="status" defaultValue="ACTIVE">
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button className="btn btn-primary">Ekle</button>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
