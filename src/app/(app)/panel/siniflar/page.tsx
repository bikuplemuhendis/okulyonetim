import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveClassroom } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";

export default async function ClassroomsPage() {
  const actor = await requireActor();
  const branches = await scopedBranches(actor);
  const classrooms = await prisma.classroom.findMany({
    where: tenantFilter(actor),
    include: { branch: true, _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });
  const teachers = await prisma.user.findMany({
    where: { ...tenantFilter(actor), role: "TEACHER" },
  });
  const locations = await prisma.location.findMany({ where: tenantFilter(actor) });
  return (
    <div>
      <PageHeader title="Sınıflar" subtitle="Sınıf adı, seviye, şube, danışman ve lokasyon eşlemesi." />
      <form action={saveClassroom} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        <select className="select" name="branchId">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input className="input" name="name" placeholder="12-A" required />
        <input className="input" name="gradeLevel" placeholder="Seviye (12)" required />
        <select className="select" name="advisorId">
          <option value="">Danışman (ops.)</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="select" name="locationId">
          <option value="">Lokasyon (ops.)</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">Ekle</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Sınıf</th>
              <th>Şube</th>
              <th>Seviye</th>
              <th>Öğrenci</th>
            </tr>
          </thead>
          <tbody>
            {classrooms.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.branch.name}</td>
                <td>{c.gradeLevel}</td>
                <td>{c._count.students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
