import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { FileLink } from "@/components/sis-ui";
import { submitHomeworkAction } from "@/app/sis-actions";
import { requireOwnStudent } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function StudentHomeworkDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const { id } = await params;
  const sp = await searchParams;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { course: true, submissions: { where: { studentId: student.id } } },
  });
  if (!assignment || assignment.classroomId !== student.classroomId || !assignment.published) notFound();
  const sub = assignment.submissions[0];
  const closed = assignment.status === "CLOSED" || sub?.status === "GRADED";
  return (
    <div>
      <PageHeader
        title={assignment.title}
        subtitle={`${assignment.course.name} · son ${formatTrDateTime(assignment.dueAt)}`}
        actions={
          <Link className="btn btn-ghost" href="/ogrenci/odevler">
            Liste
          </Link>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <p className="card p-4 mb-6 text-sm whitespace-pre-wrap">{assignment.body}</p>
      {sub ? (
        <div className="card p-4 mb-6 text-sm">
          <div>Durum: {sub.status}</div>
          {sub.body ? <p className="mt-1">{sub.body}</p> : null}
          {sub.storedName ? <FileLink id={sub.id} label={sub.fileName || "dosya"} /> : null}
          {sub.score != null ? (
            <p className="mt-2 font-medium">
              Not: {sub.score} / {assignment.maxScore}
            </p>
          ) : null}
          {sub.feedback ? <p className="text-slate-600">{sub.feedback}</p> : null}
        </div>
      ) : null}
      {closed ? null : (
        <form action={submitHomeworkAction} className="card p-5 space-y-3">
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <textarea className="textarea" name="body" placeholder="Teslim metni" defaultValue={sub?.body ?? ""} />
          <input className="input" type="file" name="file" />
          <button className="btn btn-primary">Teslim et</button>
        </form>
      )}
    </div>
  );
}
