import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveAnnouncementAction, deleteAnnouncementAction } from "@/app/sis-actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { formatTrDateTime } from "@/lib/time";
import { parseJsonArray } from "@/lib/types";
import { Flash } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import Link from "next/link";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const items = await prisma.announcement.findMany({
    where: tenantFilter(actor),
    include: { author: true, branch: true },
    orderBy: { createdAt: "desc" },
  });
  const editing = items.find((a) => a.id === sp.edit);
  const branches = await scopedBranches(actor);
  const canEdit = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Duyurular" subtitle="Şube veya kurum geneli duyurular; veli/öğrenci/öğretmen kitleleri." />
      <Flash ok={sp.ok} err={sp.err} />
      {canEdit ? (
        <form action={saveAnnouncementAction} className="card p-5 mb-6 space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input className="input" name="title" placeholder="Başlık" required defaultValue={editing?.title ?? ""} />
          <textarea className="textarea" name="body" placeholder="Metin" required defaultValue={editing?.body ?? ""} />
          <select className="select" name="branchId" defaultValue={editing?.branchId ?? ""}>
            <option value="">Tüm şubeler</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="text-sm">
            {["PARENT", "STUDENT", "TEACHER", "BRANCH_OPS"].map((r) => (
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
          <div className="flex gap-2">
            <button className="btn btn-primary">{editing ? "Güncelle" : "Yayınla"}</button>
            {editing ? (
              <Link className="btn btn-ghost" href="/panel/duyurular">
                Vazgeç
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}
      <div className="space-y-3">
        {items.map((a) => (
          <article key={a.id} className="card p-5">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">{a.title}</h2>
                <p className="text-xs text-slate-500">
                  {a.author.name} · {a.branch?.name ?? "Kurum"} · {formatTrDateTime(a.createdAt)} ·{" "}
                  {parseJsonArray(a.audience).join(", ")}
                </p>
                <p className="mt-2 text-sm">{a.body}</p>
              </div>
              {canEdit ? (
                <div className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/duyurular?edit=${a.id}`}>
                    Düzenle
                  </Link>
                  <ConfirmDelete action={deleteAnnouncementAction} id={a.id} />
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
