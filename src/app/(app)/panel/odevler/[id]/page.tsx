import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { gradeSubmissionAction } from "@/app/sis-actions";
import { assertBranch, assertTenant, canEnterGrades } from "@/lib/rbac";
import { SUBMISSION_STATUS_LABELS } from "@/lib/sis";
import { FileLink } from "@/components/sis-ui";
import { formatTrDateTime } from "@/lib/time";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AssignmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      course: true,
      classroom: { include: { students: { where: { status: "ACTIVE" }, orderBy: { name: "asc" } } } },
      submissions: true,
    },
  });
  if (!assignment) notFound();
  try {
    assertTenant(actor, assignment.tenantId);
    assertBranch(actor, assignment.branchId);
  } catch {
    notFound();
  }
  if (actor.role === "TEACHER" && assignment.teacherId !== actor.id) notFound();
  const can = canEnterGrades(actor.role);
  return (
    <div>
      <PageHeader
        title={assignment.title}
        subtitle={`${assignment.classroom.name} · ${assignment.course.name} · son ${formatTrDateTime(assignment.dueAt)}`}
        actions={
          <Link className="btn btn-ghost" href="/panel/odevler">
            Liste
          </Link>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <p className="card p-4 mb-6 text-sm whitespace-pre-wrap">{assignment.body}</p>
      <div className="space-y-3">
        {assignment.classroom.students.map((s) => {
          const sub = assignment.submissions.find((x) => x.studentId === s.id);
          return (
            <div key={s.id} className="card p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {sub ? SUBMISSION_STATUS_LABELS[sub.status] : "Teslim yok"}
                    {sub?.submittedAt ? ` · ${formatTrDateTime(sub.submittedAt)}` : ""}
                  </div>
                  {sub?.body ? <p className="text-sm mt-1">{sub.body}</p> : null}
                  {sub?.storedName ? <FileLink id={sub.id} label={sub.fileName || "dosya"} /> : null}
                </div>
                {can && sub ? (
                  <form action={gradeSubmissionAction} className="flex flex-col gap-2 min-w-[200px]">
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input type="hidden" name="submissionId" value={sub.id} />
                    <input
                      className="input"
                      name="score"
                      type="number"
                      step="0.5"
                      min={0}
                      max={assignment.maxScore}
                      defaultValue={sub.score ?? ""}
                      placeholder={`Puan / ${assignment.maxScore}`}
                      required
                    />
                    <input className="input" name="feedback" defaultValue={sub.feedback ?? ""} placeholder="Geri bildirim" />
                    <button className="btn btn-primary">Notlandır</button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
