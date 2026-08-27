import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { requireOwnStudent, studentCourseAverage } from "@/lib/sis-service";
import { letterFromPercent } from "@/lib/sis";
import { redirect } from "next/navigation";

export default async function StudentGrades() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const term = await prisma.academicTerm.findFirst({ where: { tenantId: student.tenantId, isCurrent: true } });
  const courses = await prisma.course.findMany({
    where: { schedules: { some: { classroomId: student.classroomId } } },
  });
  const exams = term
    ? await prisma.exam.findMany({
        where: { termId: term.id, published: true, classroomId: student.classroomId },
        include: { scores: { where: { studentId: student.id } }, course: true },
      })
    : [];
  const rows = [];
  for (const c of courses) {
    const avg = term
      ? await studentCourseAverage({ studentId: student.id, courseId: c.id, termId: term.id, publishedOnly: true })
      : null;
    rows.push({ course: c, avg });
  }
  return (
    <div>
      <PageHeader title="Notlarım" subtitle={term?.name ?? "Dönem seçilmedi"} />
      <div className="card overflow-x-auto mb-6">
        <table className="table">
          <thead>
            <tr>
              <th>Ders</th>
              <th>Ort.</th>
              <th>Harf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.course.id}>
                <td>{r.course.name}</td>
                <td>{r.avg ?? "—"}</td>
                <td>{r.avg != null ? letterFromPercent(r.avg) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Sınav</th>
              <th>Ders</th>
              <th>Puan</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.course.name}</td>
                <td>{e.scores[0] ? `${e.scores[0].score} / ${e.maxScore}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
