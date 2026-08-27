import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { ChildSwitcher } from "@/components/sis-ui";
import { parentStudents } from "@/lib/sis-service";
import { redirect } from "next/navigation";

export default async function ParentReport({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await parentStudents(actor);
  const sp = await searchParams;
  const student = links.find((l) => l.studentId === sp.child)?.student ?? links[0]?.student;
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const cards = await prisma.reportCard.findMany({
    where: { studentId: student.id, published: true },
    include: { term: true, lines: { include: { course: true } } },
    orderBy: { generatedAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Karne" subtitle={`${student.name} — yayımlanmış dönem karneleri.`} />
      <ChildSwitcher items={links.map((l) => ({ id: l.studentId, name: l.student.name }))} currentId={student.id} />
      {cards.map((c) => (
        <div key={c.id} className="card overflow-x-auto mb-4">
          <h2 className="font-semibold p-4 pb-0">{c.term.name}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Ders</th>
                <th>Ort.</th>
                <th>Harf</th>
                <th>5’lik</th>
              </tr>
            </thead>
            <tbody>
              {c.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.course.name}</td>
                  <td>{l.average}</td>
                  <td>{l.letter}</td>
                  <td>{l.fivePoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {!cards.length ? <p className="text-sm text-slate-500">Yayımlanmış karne yok.</p> : null}
    </div>
  );
}
