import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { linkParentAction, saveStudent, unlinkParentAction } from "@/app/actions";
import { notFound } from "next/navigation";
import { assertTenant } from "@/lib/rbac";
import { loadTenant, maskForActor } from "@/lib/services";
import { Flash } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";

export default async function StudentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      classroom: true,
      branch: true,
      user: true,
      parents: { include: { parent: true } },
      attendance: {
        include: { session: { include: { schedule: { include: { course: true } } } } },
        take: 20,
        orderBy: { markedAt: "desc" },
      },
    },
  });
  if (!student) notFound();
  try {
    assertTenant(actor, student.tenantId);
  } catch {
    notFound();
  }
  const tenant = await loadTenant(actor);
  const classrooms = await prisma.classroom.findMany({ where: { branchId: student.branchId } });
  return (
    <div>
      <PageHeader title={student.name} subtitle={`${student.studentNo} · ${student.classroom.name}`} />
      <Flash ok={sp.ok} err={sp.err} />
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
          <input
            className="input"
            name="studentEmail"
            type="email"
            placeholder="Öğrenci giriş e-postası"
            defaultValue={student.user?.email ?? ""}
          />
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
          <ul className="text-sm space-y-2 mb-4">
            {student.parents.map((p) => {
              const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", {
                phone: p.parent.phone,
                email: p.parent.email,
              });
              return (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>
                    {p.parent.name} ({p.relationship}) · {masked.phone} · KVKK: {p.kvkkConsent ? "Onaylı" : "Yok"}
                  </span>
                  {["TEACHER", "PARENT", "STUDENT"].includes(actor.role) ? null : (
                    <ConfirmDelete
                      action={unlinkParentAction}
                      id={p.id}
                      extra={{ studentId: student.id }}
                      label="Çöz"
                      prompt="Veli bağını kaldırmak istiyor musunuz?"
                    />
                  )}
                </li>
              );
            })}
            {!student.parents.length ? <li className="text-slate-500">Veli bağlı değil.</li> : null}
          </ul>
          {["TEACHER", "PARENT", "STUDENT"].includes(actor.role) ? null : (
            <form action={linkParentAction} className="grid gap-2">
              <input type="hidden" name="studentId" value={student.id} />
              <input className="input" name="name" placeholder="Veli adı" required />
              <input className="input" name="email" type="email" placeholder="E-posta" required />
              <input className="input" name="phone" placeholder="Telefon" required />
              <select className="select" name="relationship" defaultValue="ANNE">
                <option value="ANNE">Anne</option>
                <option value="BABA">Baba</option>
                <option value="VASI">Vasi</option>
                <option value="DIGER">Diğer</option>
              </select>
              <label className="text-sm">
                <input type="checkbox" name="kvkkConsent" required /> KVKK açık rıza
              </label>
              <button className="btn btn-primary">Veli bağla</button>
            </form>
          )}
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
