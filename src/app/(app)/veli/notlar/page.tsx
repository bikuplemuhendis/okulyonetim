import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { ChildSwitcher } from "@/components/sis-ui";
import { parentStudents, studentCourseAverage } from "@/lib/sis-service";
import { letterFromPercent } from "@/lib/sis";
import { redirect } from "next/navigation";

export default async function ParentGrades({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await parentStudents(actor);
  const sp = await searchParams;
  const student = links.find((l) => l.studentId === sp.child)?.student ?? links[0]?.student;
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const term = await prisma.academicTerm.findFirst({
    where: { tenantId: student.tenantId, isCurrent: true },
  });
  const courses = await prisma.course.findMany({
    where: { schedules: { some: { classroomId: student.classroomId } } },
  });
  const exams = term
    ? await prisma.exam.findMany({
        where: { termId: term.id, published: true, classroomId: student.classroomId },
        include: { scores: { where: { studentId: student.id } }, course: true },
        orderBy: { examDate: "asc" },
      })
    : [];
  const rows = [];
  for (const c of courses) {
    const avg = term
      ? await studentCourseAverage({
          studentId: student.id,
          courseId: c.id,
          termId: term.id,
          publishedOnly: true,
        })
      : null;
    rows.push({ course: c, avg });
  }
  return (
    <div>
      <PageHeader title="Notlar" subtitle={`${student.name} — yayımlanmış sınav ve ödev notları.`} />
      <ChildSwitcher items={links.map((l) => ({ id: l.studentId, name: l.student.name }))} currentId={student.id} />
      <div className="card overflow-x-auto mb-6">
        <table className="table">
          <thead>
            <tr>
              <th>Ders</th>
              <th>Ortalama</th>
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
