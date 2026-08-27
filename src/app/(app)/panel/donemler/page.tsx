import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant, dateInputValue } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteTermAction, saveTerm, setCurrentTermAction } from "@/app/sis-actions";
import { tenantFilter } from "@/lib/rbac";
import { TERM_STATUS_LABELS } from "@/lib/sis";
import { canManageTerms } from "@/lib/rbac";
import Link from "next/link";

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const terms = await prisma.academicTerm.findMany({
    where: tenantFilter(actor),
    orderBy: { startDate: "desc" },
  });
  const editing = terms.find((t) => t.id === sp.edit);
  const can = canManageTerms(actor.role);
  return (
    <div>
      <PageHeader title="Akademik dönemler" subtitle="Güz/bahar dönemleri. Güncel dönem not, sınav ve karne varsayılanıdır." />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <form action={saveTerm} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input className="input" name="name" placeholder="2026-2027 1. Dönem" required defaultValue={editing?.name ?? ""} />
          <input className="input" type="date" name="startDate" required defaultValue={dateInputValue(editing?.startDate)} />
          <input className="input" type="date" name="endDate" required defaultValue={dateInputValue(editing?.endDate)} />
          <select className="select" name="status" defaultValue={editing?.status ?? "PLANNED"}>
            {Object.entries(TERM_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="isCurrent" defaultChecked={editing?.isCurrent} /> Güncel dönem
          </label>
          <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
          {editing ? (
            <Link className="btn btn-ghost" href="/panel/donemler">
              Vazgeç
            </Link>
          ) : null}
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Tarih</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.name} {t.isCurrent ? <span className="badge bg-kampus-100 text-kampus-700">güncel</span> : null}
                </td>
                <td>
                  {dateInputValue(t.startDate)} → {dateInputValue(t.endDate)}
                </td>
                <td>{TERM_STATUS_LABELS[t.status]}</td>
                <td className="flex gap-3">
                  {can ? (
                    <>
                      <Link className="text-kampus-700 text-xs" href={`/panel/donemler?edit=${t.id}`}>
                        Düzenle
                      </Link>
                      {!t.isCurrent ? (
                        <form action={setCurrentTermAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="text-kampus-700 text-xs" type="submit">
                            Güncel yap
                          </button>
                        </form>
                      ) : null}
                      <ConfirmDelete action={deleteTermAction} id={t.id} />
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
