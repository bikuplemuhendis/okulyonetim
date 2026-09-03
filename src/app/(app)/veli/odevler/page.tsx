import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";
import { student360 } from "@/lib/sis";
import { Pill } from "@/components/sis-ui";

export default async function ParentHw({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const { student } = await parentChildren(actor, (await searchParams).child);
  if (!student) return <p>Öğrenci yok.</p>;
  const snap = await student360(actor, student.id);
  return (
    <div>
      <PageHeader title="Ödevler" subtitle={`${student.name} — teslim ve son tarih`} />
      <div className="space-y-3">
        {snap?.student.homeworkSubs.map((h) => (
          <article key={h.id} className="card p-5">
            <div className="flex justify-between"><h2 className="font-semibold">{h.homework.title}</h2><Pill>{h.status}</Pill></div>
            <p className="text-sm text-slate-500">{h.homework.course.name} · son {h.homework.dueDate}</p>
            <p className="text-sm mt-1">{h.homework.instructions}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
