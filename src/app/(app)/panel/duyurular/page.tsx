import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveAnnouncement } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { formatTrDateTime } from "@/lib/time";
import { parseJsonArray } from "@/lib/types";

export default async function AnnouncementsPage() {
  const actor = await requireActor();
  const items = await prisma.announcement.findMany({
    where: tenantFilter(actor),
    include: { author: true, branch: true },
    orderBy: { createdAt: "desc" },
  });
  const branches = await scopedBranches(actor);
  return (
    <div>
      <PageHeader title="Duyurular" subtitle="Şube veya kurum geneli duyurular; veli/öğrenci/öğretmen kitleleri." />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveAnnouncement} className="card p-5 mb-6 space-y-3">
          <input className="input" name="title" placeholder="Başlık" required />
          <textarea className="textarea" name="body" placeholder="Metin" required />
          <select className="select" name="branchId">
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
                <input type="checkbox" name="audience" value={r} defaultChecked /> {r}
              </label>
            ))}
          </div>
          <button className="btn btn-primary">Yayınla</button>
        </form>
      )}
      <div className="space-y-3">
        {items.map((a) => (
          <article key={a.id} className="card p-5">
            <h2 className="font-semibold">{a.title}</h2>
            <p className="text-xs text-slate-500">
              {a.author.name} · {a.branch?.name ?? "Kurum"} · {formatTrDateTime(a.createdAt)} ·{" "}
              {parseJsonArray(a.audience).join(", ")}
            </p>
            <p className="mt-2 text-sm">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
