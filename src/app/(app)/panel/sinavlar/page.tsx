import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant, dateInputValue } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteExamAction, saveExam } from "@/app/sis-actions";
import { canEnterGrades, tenantFilter } from "@/lib/rbac";
import { EXAM_TYPE_LABELS } from "@/lib/sis";
import { currentTerm, teacherClassroomIds } from "@/lib/sis-service";
import { scopedBranches } from "@/lib/services";
import Link from "next/link";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const classIds = actor.role === "TEACHER" ? await teacherClassroomIds(actor) : [];
  const exams = await prisma.exam.findMany({
    where: {
      ...tenantFilter(actor),
      ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}),
    },
    include: { course: true, classroom: true, term: true, teacher: true, _count: { select: { scores: true } } },
    orderBy: { examDate: "desc" },
  });
  const editing = exams.find((e) => e.id === sp.edit);
  const term = actor.tenantId ? await currentTerm(actor.tenantId) : null;
  const terms = await prisma.academicTerm.findMany({ where: tenantFilter(actor) });
  const branches = await scopedBranches(actor);
  const courses = await prisma.course.findMany({ where: tenantFilter(actor) });
  const classrooms = await prisma.classroom.findMany({
    where: { ...tenantFilter(actor), ...(classIds.length ? { id: { in: classIds } } : {}) },
  });
  const teachers = await prisma.user.findMany({ where: { ...tenantFilter(actor), role: "TEACHER" } });
  const can = canEnterGrades(actor.role);
  return (
    <div>
      <PageHeader title="Sınavlar" subtitle="Tanım, ağırlık, tam puan ve yayın. Puan girişi sınav detayındadır." />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <form action={saveExam} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input className="input" name="name" placeholder="1. Yazılı" required defaultValue={editing?.name ?? ""} />
          <select className="select" name="termId" defaultValue={editing?.termId ?? term?.id}>
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
          <select className="select" name="classroomId" defaultValue={editing?.classroomId ?? ""}>
            <option value="">Sınıf seçin</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {actor.role !== "TEACHER" ? (
            <select className="select" name="teacherId" defaultValue={editing?.teacherId}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
          <input className="input" type="date" name="examDate" required defaultValue={dateInputValue(editing?.examDate)} />
          <select className="select" name="examType" defaultValue={editing?.examType ?? "WRITTEN"}>
            {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className="input" type="number" step="0.5" name="maxScore" defaultValue={String(editing?.maxScore ?? 100)} />
          <input className="input" type="number" step="0.1" name="weight" defaultValue={String(editing?.weight ?? 1)} />
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked={editing?.published} /> Velilere yayınla
          </label>
          <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Sınav</th>
              <th>Ders / sınıf</th>
              <th>Tarih</th>
              <th>Puan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.name} {e.published ? <span className="badge bg-emerald-100 text-emerald-800">yayın</span> : <span className="badge bg-slate-100">taslak</span>}
                </td>
                <td>
                  {e.course.name} / {e.classroom?.name ?? "—"} · {e.teacher.name}
                </td>
                <td>{dateInputValue(e.examDate)}</td>
                <td>
                  {e._count.scores} kayıt · {e.maxScore} tam · ağırlık {e.weight}
                </td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/sinavlar/${e.id}`}>
                    Puanlar
                  </Link>
                  {can ? (
                    <>
                      <Link className="text-kampus-700 text-xs" href={`/panel/sinavlar?edit=${e.id}`}>
                        Düzenle
                      </Link>
                      <ConfirmDelete action={deleteExamAction} id={e.id} />
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
