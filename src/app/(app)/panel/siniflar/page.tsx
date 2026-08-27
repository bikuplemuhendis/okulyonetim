import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteClassroomAction, saveClassroom } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { CLASS_SECTIONS, GRADE_BANDS, GRADE_LEVELS } from "@/lib/domain";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import Link from "next/link";

export default async function ClassroomsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const branches = await scopedBranches(actor);
  const classrooms = await prisma.classroom.findMany({
    where: {
      ...tenantFilter(actor),
      ...(branches.length && !["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)
        ? { branchId: { in: branches.map((b) => b.id) } }
        : {}),
    },
    include: { branch: true, _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });
  const teachers = await prisma.user.findMany({
    where: { ...tenantFilter(actor), role: { in: ["TEACHER", "BRANCH_MANAGER"] } },
  });
  const locations = await prisma.location.findMany({ where: tenantFilter(actor) });
  const editing = classrooms.find((c) => c.id === sp.edit);
  return (
    <div>
      <PageHeader title="Sınıflar" subtitle="Kademe, seviye, şube harfi, danışman ve lokasyon eşlemesi." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveClassroom} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <select className="select" name="branchId" defaultValue={editing?.branchId}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select className="select" name="band" defaultValue={editing?.band ?? "LISE"}>
          {GRADE_BANDS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select className="select" name="gradeLevel" defaultValue={editing?.gradeLevel ?? "12"} required>
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select className="select" name="section" defaultValue={editing?.section ?? "A"}>
          <option value="">Şube harfi yok</option>
          {CLASS_SECTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input className="input" name="name" placeholder="Ad (boşsa 12-A)" defaultValue={editing?.name ?? ""} />
        <select className="select" name="advisorId" defaultValue={editing?.advisorId ?? ""}>
          <option value="">Danışman (ops.)</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="select" name="locationId" defaultValue={editing?.locationId ?? ""}>
          <option value="">Lokasyon (ops.)</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="select" name="status" defaultValue={editing?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
        {editing ? (
          <Link className="btn btn-ghost" href="/panel/siniflar">
            Vazgeç
          </Link>
        ) : null}
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Sınıf</th>
              <th>Şube</th>
              <th>Kademe / seviye</th>
              <th>Öğrenci</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {classrooms.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.branch.name}</td>
                <td>
                  {c.band ?? "—"} / {c.gradeLevel}
                  {c.section ? `-${c.section}` : ""}
                </td>
                <td>{c._count.students}</td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/siniflar?edit=${c.id}`}>
                    Düzenle
                  </Link>
                  <ConfirmDelete action={deleteClassroomAction} id={c.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
