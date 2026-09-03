import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { advanceLeadAction, saveLeadAction } from "@/app/sis-actions";
import { Pill } from "@/components/sis-ui";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const leads = await prisma.admissionLead.findMany({
    where: tenantFilter(actor),
    include: { owner: true, branch: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Ön kayıt / aday hunisi" subtitle="Misafir → görüşme → teklif → kayıt. K12NET kayıt + ön kayıt birleşimi." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveLeadAction} className="card p-5 grid md:grid-cols-3 gap-3 mb-6">
        <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input className="input" name="studentName" placeholder="Aday öğrenci" required />
        <input className="input" name="parentName" placeholder="Veli" required />
        <input className="input" name="phone" placeholder="Telefon" required />
        <input className="input" name="gradeLevel" placeholder="9" required />
        <input className="input" name="offeredFee" type="number" placeholder="Teklif (₺)" />
        <textarea className="textarea md:col-span-3" name="note" placeholder="Görüşme notu" required />
        <button className="btn btn-primary">Aday ekle</button>
      </form>
      <div className="space-y-3">
        {leads.map((l) => (
          <article key={l.id} className="card p-5 flex flex-wrap justify-between gap-3">
            <div>
              <div className="flex gap-2 items-center"><h2 className="font-semibold">{l.studentName}</h2><Pill>{l.status}</Pill></div>
              <p className="text-sm text-slate-600">{l.parentName} · {l.phone} · {l.gradeLevel}. sınıf · {l.branch.name}</p>
              <p className="text-sm mt-1">{l.note}</p>
              <p className="text-xs text-slate-500">Sahip: {l.owner.name}{l.offeredFee ? ` · teklif ₺${l.offeredFee}` : ""}</p>
            </div>
            <form action={advanceLeadAction} className="flex gap-2">
              <input type="hidden" name="leadId" value={l.id} />
              <select className="select" name="status" defaultValue={l.status}>
                <option value="GUEST">Misafir</option>
                <option value="MEETING">Görüşme</option>
                <option value="OFFER">Teklif</option>
                <option value="ENROLLED">Kayıt</option>
                <option value="LOST">Kayıp</option>
              </select>
              <button className="btn btn-ghost">İlerle</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
