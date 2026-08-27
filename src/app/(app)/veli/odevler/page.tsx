import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { ChildSwitcher } from "@/components/sis-ui";
import { parentStudents } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function ParentHomework({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await parentStudents(actor);
  const sp = await searchParams;
  const student = links.find((l) => l.studentId === sp.child)?.student ?? links[0]?.student;
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const rows = await prisma.assignment.findMany({
    where: { classroomId: student.classroomId, published: true },
    include: { course: true, submissions: { where: { studentId: student.id } } },
    orderBy: { dueAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Ödevler" subtitle={`${student.name} — yayımlanmış ödevler ve teslim durumu.`} />
      <ChildSwitcher items={links.map((l) => ({ id: l.studentId, name: l.student.name }))} currentId={student.id} />
      <div className="space-y-3">
        {rows.map((r) => {
          const sub = r.submissions[0];
          return (
            <article key={r.id} className="card p-4">
              <div className="font-medium">{r.title}</div>
              <p className="text-sm text-slate-600">{r.course.name} · son {formatTrDateTime(r.dueAt)}</p>
              <p className="text-sm mt-1">{r.body}</p>
              <p className="text-xs text-slate-500 mt-2">
                {sub?.status === "GRADED"
                  ? `Not: ${sub.score} / ${r.maxScore}`
                  : sub
                    ? "Teslim edildi"
                    : "Teslim yok"}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
