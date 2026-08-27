import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteAssignmentAction, saveAssignment } from "@/app/sis-actions";
import { canEnterGrades, tenantFilter } from "@/lib/rbac";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/sis";
import { currentTerm, teacherClassroomIds } from "@/lib/sis-service";
import { scopedBranches } from "@/lib/services";
import { formatTrDateTime } from "@/lib/time";
import Link from "next/link";

function toLocal(d?: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const classIds = actor.role === "TEACHER" ? await teacherClassroomIds(actor) : [];
  const rows = await prisma.assignment.findMany({
    where: {
      ...tenantFilter(actor),
      ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}),
    },
    include: { course: true, classroom: true, _count: { select: { submissions: true } } },
    orderBy: { dueAt: "desc" },
  });
  const editing = rows.find((r) => r.id === sp.edit);
  const term = actor.tenantId ? await currentTerm(actor.tenantId) : null;
  const terms = await prisma.academicTerm.findMany({ where: tenantFilter(actor) });
  const branches = await scopedBranches(actor);
  const courses = await prisma.course.findMany({ where: tenantFilter(actor) });
  const classrooms = await prisma.classroom.findMany({
    where: { ...tenantFilter(actor), ...(classIds.length ? { id: { in: classIds } } : {}) },
  });
  const can = canEnterGrades(actor.role);
  return (
    <div>
      <PageHeader title="Ödevler" subtitle="Sınıf ve derse ödev verin; teslim ve notlandırma detay sayfasındadır." />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <form action={saveAssignment} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input className="input md:col-span-2" name="title" required placeholder="Ödev başlığı" defaultValue={editing?.title ?? ""} />
          <select className="select" name="status" defaultValue={editing?.status ?? "PUBLISHED"}>
            {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <textarea className="textarea md:col-span-3" name="body" required defaultValue={editing?.body ?? ""} />
          <select className="select" name="termId" defaultValue={editing?.termId ?? term?.id ?? ""}>
            <option value="">Dönem yok</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="select" name="branchId" defaultValue={editing?.branchId ?? branches[0]?.id}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select" name="courseId" defaultValue={editing?.courseId}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="classroomId" defaultValue={editing?.classroomId}>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input" type="datetime-local" name="dueAt" required defaultValue={toLocal(editing?.dueAt)} />
          <input className="input" type="number" name="maxScore" defaultValue={String(editing?.maxScore ?? 100)} />
          <input className="input" type="number" step="0.1" name="weight" defaultValue={String(editing?.weight ?? 1)} />
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked={editing?.published ?? true} /> Öğrenci görsün
          </label>
          <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ödev</th>
              <th>Sınıf / ders</th>
              <th>Teslim</th>
              <th>Teslim sayısı</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  {r.classroom.name} / {r.course.name}
                </td>
                <td>{formatTrDateTime(r.dueAt)}</td>
                <td>{r._count.submissions}</td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/odevler/${r.id}`}>
                    Teslimler
                  </Link>
                  {can ? (
                    <>
                      <Link className="text-kampus-700 text-xs" href={`/panel/odevler?edit=${r.id}`}>
                        Düzenle
                      </Link>
                      <ConfirmDelete action={deleteAssignmentAction} id={r.id} />
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
