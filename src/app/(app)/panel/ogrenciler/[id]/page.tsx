import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveStudent } from "@/app/actions";
import { notFound } from "next/navigation";
import { loadTenant, maskForActor } from "@/lib/services";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      classroom: true,
      branch: true,
      parents: { include: { parent: true } },
      attendance: { include: { session: { include: { schedule: { include: { course: true } } } } }, take: 20, orderBy: { markedAt: "desc" } },
    },
  });
  if (!student) notFound();
  const tenant = await loadTenant(actor);
  const classrooms = await prisma.classroom.findMany({ where: { branchId: student.branchId } });
  return (
    <div>
      <PageHeader title={student.name} subtitle={`${student.studentNo} · ${student.classroom.name}`} />
      {["TEACHER", "PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveStudent} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
          <input type="hidden" name="id" value={student.id} />
          <input type="hidden" name="branchId" value={student.branchId} />
          <input className="input" name="name" defaultValue={student.name} />
          <input className="input" name="studentNo" defaultValue={student.studentNo} />
          <select className="select" name="classroomId" defaultValue={student.classroomId}>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="status" defaultValue={student.status}>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="GRADUATED">Mezun</option>
          </select>
          <button className="btn btn-primary">Güncelle</button>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Veliler</h2>
          <ul className="text-sm space-y-2">
            {student.parents.map((p) => {
              const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", {
                phone: p.parent.phone,
                email: p.parent.email,
              });
              return (
                <li key={p.id}>
                  {p.parent.name} ({p.relationship}) · {masked.phone} · KVKK: {p.kvkkConsent ? "Onaylı" : "Yok"}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Son yoklamalar</h2>
          <ul className="text-sm space-y-1">
            {student.attendance.map((a) => (
              <li key={a.id}>
                {a.session.date} {a.session.schedule.course.name}: <strong>{a.status}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
