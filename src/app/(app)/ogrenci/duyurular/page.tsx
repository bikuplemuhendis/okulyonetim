import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { visibleAnnouncements } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function StudentAnnouncements() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const items = await visibleAnnouncements(actor);
  return (
    <div>
      <PageHeader title="Duyurular" />
      <div className="space-y-3">
        {items.map((a) => (
          <article key={a.id} className="card p-5">
            <h2 className="font-semibold">{a.title}</h2>
            <p className="text-xs text-slate-500">
              {a.author.name} · {formatTrDateTime(a.createdAt)}
            </p>
            <p className="mt-2 text-sm">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
