import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";
import { student360 } from "@/lib/sis";

export default async function ParentGrades({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const { student } = await parentChildren(actor, (await searchParams).child);
  if (!student) return <p>Öğrenci yok.</p>;
  const snap = await student360(actor, student.id);
  return (
    <div>
      <PageHeader title="Notlar" subtitle={`${student.name} · ağırlıklı ortalama ${snap?.avg ?? "—"}`} />
      <table className="table card">
        <thead><tr><th>Ders</th><th>Ölçme</th><th>Puan</th><th>Yorum</th></tr></thead>
        <tbody>
          {snap?.student.grades.map((g) => (
            <tr key={g.id}>
              <td>{g.assessment.course.name}</td>
              <td>{g.assessment.title}</td>
              <td>{g.score}/{g.assessment.maxScore}</td>
              <td>{g.comment ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
