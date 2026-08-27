import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { parentStudents } from "@/lib/sis-service";
import { CALENDAR_TYPE_LABELS } from "@/lib/sis";
import { formatTrDateTime } from "@/lib/time";
import { parseJsonArray } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function ParentCalendar() {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await parentStudents(actor);
  const branchIds = [...new Set(links.map((l) => l.student.branchId))];
  const events = await prisma.calendarEvent.findMany({
    where: {
      tenantId: actor.tenantId ?? undefined,
      OR: [{ branchId: null }, { branchId: { in: branchIds } }],
    },
    orderBy: { startsAt: "asc" },
  });
  const visible = events.filter((e) => {
    const aud = parseJsonArray(e.audience);
    return !aud.length || aud.includes("PARENT");
  });
  return (
    <div>
      <PageHeader title="Okul takvimi" subtitle="Tatil, sınav ve toplantı günleri." />
      <div className="space-y-3">
        {visible.map((e) => (
          <article key={e.id} className="card p-4">
            <div className="text-xs text-slate-500">{CALENDAR_TYPE_LABELS[e.type]}</div>
            <h2 className="font-semibold">{e.title}</h2>
            <p className="text-sm text-slate-600">{e.body}</p>
            <p className="text-xs text-slate-500 mt-1">
              {formatTrDateTime(e.startsAt)} — {formatTrDateTime(e.endsAt)}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
