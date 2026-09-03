import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { redirect } from "next/navigation";
import { student360 } from "@/lib/sis";

export default async function StudentGrades() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT" || !actor.studentId) redirect("/panel");
  const snap = await student360(actor, actor.studentId);
  return (
    <div>
      <PageHeader title="Notlarım" subtitle={`Ortalama ${snap?.avg ?? "—"}`} />
      <table className="table card">
        <thead><tr><th>Ders</th><th>Ölçme</th><th>Puan</th></tr></thead>
        <tbody>
          {snap?.student.grades.map((g) => (
            <tr key={g.id}><td>{g.assessment.course.name}</td><td>{g.assessment.title}</td><td>{g.score}/{g.assessment.maxScore}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
