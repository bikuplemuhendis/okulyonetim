import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant } from "@/components/flash";
import { generateReportCardsAction, publishReportCardAction } from "@/app/sis-actions";
import { canEnterGrades, canViewStaffGrades, tenantFilter } from "@/lib/rbac";
import { currentTerm, teacherClassroomIds } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; termId?: string }>;
}) {
  const actor = await requireActor();
  if (!canViewStaffGrades(actor.role) && actor.role !== "BRANCH_OPS") redirect("/panel");
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const terms = await prisma.academicTerm.findMany({ where: tenantFilter(actor), orderBy: { startDate: "desc" } });
  const term = terms.find((t) => t.id === sp.termId) ?? (actor.tenantId ? await currentTerm(actor.tenantId) : null) ?? terms[0];
  const classIds = actor.role === "TEACHER" ? await teacherClassroomIds(actor) : [];
  const classrooms = await prisma.classroom.findMany({
    where: { ...tenantFilter(actor), ...(classIds.length ? { id: { in: classIds } } : {}) },
  });
  const cards = term
    ? await prisma.reportCard.findMany({
        where: {
          termId: term.id,
          ...(classIds.length ? { student: { classroomId: { in: classIds } } } : {}),
        },
        include: { student: { include: { classroom: true } }, lines: { include: { course: true } } },
        orderBy: { student: { name: "asc" } },
      })
    : [];
  const canGen = canEnterGrades(actor.role) || actor.role === "BRANCH_OPS";
  return (
    <div>
      <PageHeader title="Karne / transkript" subtitle="Dönem notlarından üretilir. Yayınlanınca veli ve öğrenci görür." />
      <Flash ok={sp.ok} err={sp.err} />
      {canGen && term ? (
        <form action={generateReportCardsAction} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          <select className="select" name="termId" defaultValue={term.id}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="select" name="classroomId">
            <option value="">Tüm sınıflar</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">Karneleri üret / yenile</button>
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>Dersler</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td>{c.student.name}</td>
                <td>{c.student.classroom.name}</td>
                <td className="text-xs">
                  {c.lines.map((l) => `${l.course.code} ${l.average} ${l.letter}`).join(" · ") || "—"}
                </td>
                <td>
                  {c.published ? "Yayınlı" : "Taslak"} · {formatTrDateTime(c.generatedAt)}
                </td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/karne/${c.id}`}>
                    Aç
                  </Link>
                  {canGen ? (
                    <form action={publishReportCardAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="published" value={c.published ? "0" : "1"} />
                      <button className="text-kampus-700 text-xs" type="submit">
                        {c.published ? "Gizle" : "Yayınla"}
                      </button>
                    </form>
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
