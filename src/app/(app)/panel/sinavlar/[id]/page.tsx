import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, dateInputValue } from "@/components/flash";
import { saveExamScores } from "@/app/sis-actions";
import { assertBranch, assertTenant, canEnterGrades } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ExamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: true, classroom: true, term: true, scores: true },
  });
  if (!exam) notFound();
  try {
    assertTenant(actor, exam.tenantId);
    assertBranch(actor, exam.branchId);
  } catch {
    notFound();
  }
  if (actor.role === "TEACHER" && exam.teacherId !== actor.id) notFound();
  const students = await prisma.student.findMany({
    where: {
      tenantId: exam.tenantId,
      status: "ACTIVE",
      branchId: exam.branchId,
      ...(exam.classroomId ? { classroomId: exam.classroomId } : {}),
    },
    orderBy: { name: "asc" },
  });
  const can = canEnterGrades(actor.role);
  return (
    <div>
      <PageHeader
        title={`${exam.name} — puan girişi`}
        subtitle={`${exam.course.name} · ${exam.classroom?.name ?? "şube"} · tam ${exam.maxScore}`}
        actions={
          <Link className="btn btn-ghost" href="/panel/sinavlar">
            Liste
          </Link>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveExamScores} className="card overflow-x-auto">
        <input type="hidden" name="examId" value={exam.id} />
        <input type="hidden" name="termId" value={exam.termId} />
        <input type="hidden" name="branchId" value={exam.branchId} />
        <input type="hidden" name="courseId" value={exam.courseId} />
        <input type="hidden" name="classroomId" value={exam.classroomId ?? ""} />
        <input type="hidden" name="name" value={exam.name} />
        <input type="hidden" name="examDate" value={dateInputValue(exam.examDate)} />
        <input type="hidden" name="examType" value={exam.examType} />
        <input type="hidden" name="maxScore" value={String(exam.maxScore)} />
        <input type="hidden" name="weight" value={String(exam.weight)} />
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Puan</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const sc = exam.scores.find((x) => x.studentId === s.id);
              return (
                <tr key={s.id}>
                  <td>
                    {s.name} <span className="text-slate-400">{s.studentNo}</span>
                    <input type="hidden" name="studentId" value={s.id} />
                  </td>
                  <td>
                    <input
                      className="input"
                      name={`score_${s.id}`}
                      type="number"
                      step="0.5"
                      min={0}
                      max={exam.maxScore}
                      defaultValue={sc ? String(sc.score) : ""}
                      disabled={!can}
                    />
                  </td>
                  <td>
                    <input className="input" name={`note_${s.id}`} defaultValue={sc?.note ?? ""} disabled={!can} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {can ? (
          <div className="p-4 flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" name="published" defaultChecked={exam.published} /> Velilere/öğrenciye yayınla
            </label>
            <button className="btn btn-primary">Kaydet</button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
