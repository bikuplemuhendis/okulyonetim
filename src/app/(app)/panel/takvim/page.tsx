import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteCalendarEventAction, saveCalendarEvent } from "@/app/sis-actions";
import { canManageCalendar, tenantFilter } from "@/lib/rbac";
import { CALENDAR_TYPE_LABELS } from "@/lib/sis";
import { scopedBranches } from "@/lib/services";
import { formatTrDateTime } from "@/lib/time";
import { parseJsonArray } from "@/lib/types";
import Link from "next/link";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const events = await prisma.calendarEvent.findMany({
    where: tenantFilter(actor),
    include: { branch: true, term: true },
    orderBy: { startsAt: "asc" },
  });
  const editing = events.find((e) => e.id === sp.edit);
  const branches = await scopedBranches(actor);
  const terms = await prisma.academicTerm.findMany({ where: tenantFilter(actor), orderBy: { startDate: "desc" } });
  const can = canManageCalendar(actor.role);
  return (
    <div>
      <PageHeader title="Okul takvimi" subtitle="Tatil, sınav günü, toplantı ve dönem olayları." />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <form action={saveCalendarEvent} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input className="input md:col-span-2" name="title" placeholder="Başlık" required defaultValue={editing?.title ?? ""} />
          <select className="select" name="type" defaultValue={editing?.type ?? "OTHER"}>
            {Object.entries(CALENDAR_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <textarea className="textarea md:col-span-3" name="body" required defaultValue={editing?.body ?? ""} />
          <input className="input" type="datetime-local" name="startsAt" required defaultValue={toLocal(editing?.startsAt)} />
          <input className="input" type="datetime-local" name="endsAt" required defaultValue={toLocal(editing?.endsAt)} />
          <select className="select" name="branchId" defaultValue={editing?.branchId ?? ""}>
            <option value="">Tüm şubeler</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select" name="termId" defaultValue={editing?.termId ?? ""}>
            <option value="">Dönem yok</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="allDay" defaultChecked={editing?.allDay ?? true} /> Tüm gün
          </label>
          <div className="text-sm md:col-span-3">
            {["PARENT", "STUDENT", "TEACHER"].map((r) => (
              <label key={r} className="mr-3">
                <input
                  type="checkbox"
                  name="audience"
                  value={r}
                  defaultChecked={editing ? parseJsonArray(editing.audience).includes(r) : true}
                />{" "}
                {r}
              </label>
            ))}
          </div>
          <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
          {editing ? (
            <Link className="btn btn-ghost" href="/panel/takvim">
              Vazgeç
            </Link>
          ) : null}
        </form>
      ) : null}
      <div className="space-y-3">
        {events.map((e) => (
          <article key={e.id} className="card p-5">
            <div className="flex justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">
                  {CALENDAR_TYPE_LABELS[e.type]} · {e.branch?.name ?? "Kurum"} · {e.term?.name ?? ""}
                </div>
                <h2 className="font-semibold">{e.title}</h2>
                <p className="text-sm text-slate-600">{e.body}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatTrDateTime(e.startsAt)} — {formatTrDateTime(e.endsAt)}
                </p>
              </div>
              {can ? (
                <div className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/takvim?edit=${e.id}`}>
                    Düzenle
                  </Link>
                  <ConfirmDelete action={deleteCalendarEventAction} id={e.id} />
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function toLocal(d?: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
