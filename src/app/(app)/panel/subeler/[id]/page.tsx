import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteBranchAction, saveBranch } from "@/app/actions";
import { assertTenant, canManageBranches } from "@/lib/rbac";
import { Flash } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { notFound } from "next/navigation";

export default async function BranchDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const b = await prisma.branch.findUnique({
    where: { id },
    include: { locations: true, classrooms: true, buildings: true, _count: { select: { students: true } } },
  });
  if (!b) notFound();
  try {
    assertTenant(actor, b.tenantId);
  } catch {
    notFound();
  }
  const canEdit = canManageBranches(actor.role);
  return (
    <div>
      <PageHeader title={b.name} subtitle={`${b.code} · ${b._count.students} öğrenci`} />
      <Flash ok={sp.ok} err={sp.err} />
      {canEdit ? (
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
          <div className="flex items-center gap-4">
            <button className="btn btn-primary">Güncelle</button>
            <ConfirmDelete
              action={deleteBranchAction}
              id={b.id}
              prompt="Şubeyi silmek istiyor musunuz? Öğrencisi varsa silinmez."
            />
          </div>
        </form>
      ) : null}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Binalar</h2>
          <ul className="text-sm space-y-1">
            {b.buildings.map((l) => (
              <li key={l.id}>{l.name}</li>
            ))}
          </ul>
        </div>
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
