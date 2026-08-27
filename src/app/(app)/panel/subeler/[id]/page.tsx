import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveBranch } from "@/app/actions";
import { notFound } from "next/navigation";

export default async function BranchDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireActor();
  const { id } = await params;
  const b = await prisma.branch.findUnique({
    where: { id },
    include: { locations: true, classrooms: true, _count: { select: { students: true } } },
  });
  if (!b) notFound();
  return (
    <div>
      <PageHeader title={b.name} subtitle={`${b.code} · ${b._count.students} öğrenci`} />
      <form action={saveBranch} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
        <input type="hidden" name="id" value={b.id} />
        <input className="input" name="name" defaultValue={b.name} />
        <input className="input" name="code" defaultValue={b.code} />
        <textarea className="textarea md:col-span-2" name="address" defaultValue={b.address} />
        <input className="input" name="city" defaultValue={b.city} />
        <input className="input" name="district" defaultValue={b.district} />
        <input className="input" name="phone" defaultValue={b.phone ?? ""} />
        <input className="input" name="timezone" defaultValue={b.timezone} />
        <select className="select" name="status" defaultValue={b.status}>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button className="btn btn-primary">Güncelle</button>
      </form>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Lokasyonlar</h2>
          <ul className="text-sm space-y-1">
            {b.locations.map((l) => (
              <li key={l.id}>
                {l.name} · {l.type}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Sınıflar</h2>
          <ul className="text-sm space-y-1">
            {b.classrooms.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
