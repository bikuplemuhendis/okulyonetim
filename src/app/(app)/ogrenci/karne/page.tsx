import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { requireOwnStudent } from "@/lib/sis-service";
import { redirect } from "next/navigation";

export default async function StudentReport() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const cards = await prisma.reportCard.findMany({
    where: { studentId: student.id, published: true },
    include: { term: true, lines: { include: { course: true } } },
    orderBy: { generatedAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Karnem" />
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
