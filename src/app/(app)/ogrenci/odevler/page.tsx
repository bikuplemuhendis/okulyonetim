import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { redirect } from "next/navigation";
import { student360 } from "@/lib/sis";
import { submitHomeworkAction } from "@/app/sis-actions";
import { Pill } from "@/components/sis-ui";

export default async function StudentHw({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "STUDENT" || !actor.studentId) redirect("/panel");
  const sp = await searchParams;
  const snap = await student360(actor, actor.studentId);
  return (
    <div>
      <PageHeader title="Ödevlerim" />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="space-y-3">
        {snap?.student.homeworkSubs.map((h) => (
          <article key={h.id} className="card p-5">
            <div className="flex justify-between"><h2 className="font-semibold">{h.homework.title}</h2><Pill>{h.status}</Pill></div>
            <p className="text-sm text-slate-500">{h.homework.course.name} · son {h.homework.dueDate}</p>
            <p className="text-sm mt-1">{h.homework.instructions}</p>
            {h.status === "ASSIGNED" || h.status === "LATE" ? (
              <form action={submitHomeworkAction} className="mt-3 grid gap-2">
                <input type="hidden" name="homeworkId" value={h.homeworkId} />
                <textarea className="textarea" name="answer" placeholder="Cevabınız" required />
                <button className="btn btn-primary">Teslim et</button>
              </form>
            ) : (
              <p className="text-sm mt-2">Teslim: {h.answer}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
