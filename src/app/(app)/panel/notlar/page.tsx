import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { NeedTenant } from "@/components/flash";
import { canViewStaffGrades, tenantFilter } from "@/lib/rbac";
import { currentTerm, studentCourseAverage, teacherClassroomIds } from "@/lib/sis-service";
import { fivePointFromPercent, letterFromPercent } from "@/lib/sis";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function GradebookPage({
  searchParams,
}: {
  searchParams: Promise<{ classroomId?: string; courseId?: string; termId?: string }>;
}) {
  const actor = await requireActor();
  if (!canViewStaffGrades(actor.role)) redirect("/panel");
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const classIds = actor.role === "TEACHER" ? await teacherClassroomIds(actor) : [];
  const classrooms = await prisma.classroom.findMany({
    where: { ...tenantFilter(actor), ...(classIds.length ? { id: { in: classIds } } : {}) },
    orderBy: { name: "asc" },
  });
  const classroom = classrooms.find((c) => c.id === sp.classroomId) ?? classrooms[0];
  const terms = await prisma.academicTerm.findMany({ where: tenantFilter(actor), orderBy: { startDate: "desc" } });
  const term =
    terms.find((t) => t.id === sp.termId) ??
    (actor.tenantId ? await currentTerm(actor.tenantId) : null) ??
    terms[0];
  const schedules = classroom
    ? await prisma.lessonSchedule.findMany({
        where: {
          classroomId: classroom.id,
          ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}),
        },
        include: { course: true },
      })
    : [];
  const courses = [...new Map(schedules.map((s) => [s.courseId, s.course])).values()];
  const course = courses.find((c) => c.id === sp.courseId) ?? courses[0];
  const students = classroom
    ? await prisma.student.findMany({ where: { classroomId: classroom.id, status: "ACTIVE" }, orderBy: { name: "asc" } })
    : [];
  const exams =
    course && term
      ? await prisma.exam.findMany({
          where: { courseId: course.id, termId: term.id, classroomId: classroom?.id, ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}) },
          include: { scores: true },
          orderBy: { examDate: "asc" },
        })
      : [];
  const assignments =
    course && term
      ? await prisma.assignment.findMany({
          where: { courseId: course.id, termId: term.id, classroomId: classroom?.id, ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}) },
          include: { submissions: true },
        })
      : [];

  const rows = [];
  for (const s of students) {
    const avg =
      course && term
        ? await studentCourseAverage({
            studentId: s.id,
            courseId: course.id,
            termId: term.id,
            publishedOnly: false,
          })
        : null;
    rows.push({ student: s, avg });
  }

  return (
    <div>
      <PageHeader title="Not defteri" subtitle="Sınıf + ders + dönem. Sınav ve ödev puanlarından ağırlıklı ortalama." />
      <form className="card p-4 mb-6 grid md:grid-cols-4 gap-3">
        <select className="select" name="termId" defaultValue={term?.id}>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="select" name="classroomId" defaultValue={classroom?.id}>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" name="courseId" defaultValue={course?.id}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">Göster</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              {exams.map((e) => (
                <th key={e.id}>
                  <Link href={`/panel/sinavlar/${e.id}`}>{e.name}</Link>
                </th>
              ))}
              {assignments.map((a) => (
                <th key={a.id}>
                  <Link href={`/panel/odevler/${a.id}`}>{a.title}</Link>
                </th>
              ))}
              <th>Ort.</th>
              <th>Harf</th>
              <th>5’lik</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, avg }) => (
              <tr key={student.id}>
                <td>{student.name}</td>
                {exams.map((e) => (
                  <td key={e.id}>{e.scores.find((x) => x.studentId === student.id)?.score ?? "—"}</td>
                ))}
                {assignments.map((a) => (
                  <td key={a.id}>{a.submissions.find((x) => x.studentId === student.id)?.score ?? "—"}</td>
                ))}
                <td>{avg ?? "—"}</td>
                <td>{avg != null ? letterFromPercent(avg) : "—"}</td>
                <td>{avg != null ? fivePointFromPercent(avg) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
