import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveStudent } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { loadTenant, maskForActor, scopedBranches } from "@/lib/services";
import Link from "next/link";

export default async function StudentsPage() {
  const actor = await requireActor();
  const where = tenantFilter(actor);
  const teacherClassIds =
    actor.role === "TEACHER"
      ? (await prisma.lessonSchedule.findMany({ where: { teacherId: actor.id } })).map((s) => s.classroomId)
      : [];
  const students = await prisma.student.findMany({
    where: {
      ...where,
      ...(teacherClassIds.length ? { classroomId: { in: [...new Set(teacherClassIds)] } } : {}),
    },
    include: { classroom: true, branch: true, parents: { include: { parent: true } } },
    orderBy: { name: "asc" },
  });
  const branches = await scopedBranches(actor);
  const classrooms = await prisma.classroom.findMany({ where });
  const tenant = await loadTenant(actor);
  return (
    <div>
      <PageHeader title="Öğrenciler" subtitle="Öğrenci no, sınıf, veli ve KVKK onayı. Kart UID alanı yoktur." />
      {["PARENT", "STUDENT", "TEACHER"].includes(actor.role) ? null : (
        <form action={saveStudent} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          <select className="select" name="branchId">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select" name="classroomId">
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input" name="studentNo" placeholder="Öğrenci no" required />
          <input className="input" name="name" placeholder="Ad soyad" required />
          <select className="select" name="status" defaultValue="ACTIVE">
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="GRADUATED">Mezun</option>
          </select>
          <button className="btn btn-primary">Ekle</button>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad</th>
              <th>Sınıf</th>
              <th>Veli telefon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const p = s.parents[0]?.parent;
              const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", {
                phone: p?.phone,
                email: p?.email,
              });
              return (
                <tr key={s.id}>
                  <td>{s.studentNo}</td>
                  <td>
                    <Link className="text-kampus-700 font-medium" href={`/panel/ogrenciler/${s.id}`}>
                      {s.name}
                    </Link>
                  </td>
                  <td>
                    {s.branch.code} / {s.classroom.name}
                  </td>
                  <td>{masked.phone}</td>
                  <td>
                    <Link href={`/panel/rehberlik/${s.id}`} className="text-xs">
                      360°
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
