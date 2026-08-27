import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { visibleAnnouncements } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function ParentAnnouncements() {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const items = await visibleAnnouncements(actor);
  return (
    <div>
      <PageHeader title="Duyurular" subtitle="Kurum ve şube duyuruları." />
      <div className="space-y-3">
        {items.map((a) => (
          <article key={a.id} className="card p-5">
            <h2 className="font-semibold">{a.title}</h2>
            <p className="text-xs text-slate-500">
              {a.author.name} · {a.branch?.name ?? "Kurum"} · {formatTrDateTime(a.createdAt)}
            </p>
            <p className="mt-2 text-sm">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
