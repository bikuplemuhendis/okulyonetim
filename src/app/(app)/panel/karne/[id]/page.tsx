import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { publishReportCardAction } from "@/app/sis-actions";
import { assertTenant, canEnterGrades, canViewStaffGrades } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ReportCardDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const card = await prisma.reportCard.findUnique({
    where: { id },
    include: { student: { include: { classroom: true, branch: true } }, term: true, lines: { include: { course: true } } },
  });
  if (!card) notFound();
  try {
    assertTenant(actor, card.tenantId);
  } catch {
    notFound();
  }
  if (!canViewStaffGrades(actor.role) && actor.role !== "BRANCH_OPS") notFound();
  const can = canEnterGrades(actor.role) || actor.role === "BRANCH_OPS";
  return (
    <div>
      <PageHeader
        title={`Karne — ${card.student.name}`}
        subtitle={`${card.student.classroom.name} · ${card.term.name} · ${card.published ? "yayınlı" : "taslak"}`}
        actions={
          <Link className="btn btn-ghost" href="/panel/karne">
            Liste
          </Link>
        }
      />
      {can ? (
        <form action={publishReportCardAction} className="mb-4">
          <input type="hidden" name="id" value={card.id} />
          <input type="hidden" name="published" value={card.published ? "0" : "1"} />
          <button className="btn btn-primary">{card.published ? "Yayından kaldır" : "Yayınla"}</button>
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ders</th>
              <th>Ortalama</th>
              <th>Harf</th>
              <th>5’lik</th>
            </tr>
          </thead>
          <tbody>
            {card.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.course.name} ({l.course.code})
                </td>
                <td>{l.average}</td>
                <td>{l.letter}</td>
                <td>{l.fivePoint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
