import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { redirect } from "next/navigation";
import { tenantFilter } from "@/lib/rbac";

export default async function ParentCal() {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const events = await prisma.calendarEvent.findMany({ where: tenantFilter(actor), orderBy: { startsOn: "asc" } });
  return (
    <div>
      <PageHeader title="Ajanda" subtitle="Okul etkinlikleri ve özel günler." />
      <div className="space-y-3">
        {events.map((e) => (
          <article key={e.id} className="card p-5">
            <div className="text-xs text-slate-500">{e.startsOn} → {e.endsOn}</div>
            <h2 className="font-semibold">{e.title}</h2>
            <p className="text-sm">{e.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
