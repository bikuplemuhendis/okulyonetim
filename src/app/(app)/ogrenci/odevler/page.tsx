import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { requireOwnStudent } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StudentHomework() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const rows = await prisma.assignment.findMany({
    where: { classroomId: student.classroomId, published: true, status: { not: "DRAFT" } },
    include: { course: true, submissions: { where: { studentId: student.id } } },
    orderBy: { dueAt: "asc" },
  });
  return (
    <div>
      <PageHeader title="Ödevlerim" subtitle={`${student.classroom.name}`} />
      <div className="space-y-3">
        {rows.map((r) => {
          const sub = r.submissions[0];
          return (
            <article key={r.id} className="card p-4 flex justify-between gap-3">
              <div>
                <div className="font-medium">{r.title}</div>
                <p className="text-sm text-slate-600">
                  {r.course.name} · son {formatTrDateTime(r.dueAt)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {sub?.status === "GRADED" ? `Not: ${sub.score}` : sub ? "Teslim edildi" : "Teslim bekleniyor"}
                </p>
              </div>
              <Link className="btn btn-primary" href={`/ogrenci/odevler/${r.id}`}>
                Aç
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
