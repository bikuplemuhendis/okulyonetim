import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { saveDocumentAction } from "@/app/sis-actions";
import { formatTrDateTime } from "@/lib/time";

export default async function DocsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const items = await prisma.sharedDocument.findMany({ where: tenantFilter(actor), include: { author: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="Belgeler" subtitle="Karne, sözleşme, genelge paylaşımı. Öğrenci/veli belge talebi notu olarak da kullanılır." />
      <Flash ok={sp.ok} err={sp.err} />
      {["PARENT", "STUDENT"].includes(actor.role) ? null : (
        <form action={saveDocumentAction} className="card p-5 grid gap-3 mb-6">
          <input className="input" name="title" placeholder="Başlık" required />
          <select className="select" name="kind"><option value="KARNE">Karne</option><option value="GENELGE">Genelge</option><option value="SOZLESME">Sözleşme</option><option value="DIGER">Diğer</option></select>
          <input className="input" name="audience" defaultValue='["PARENT","STUDENT"]' />
          <textarea className="textarea" name="body" placeholder="İçerik veya bağlantı" required />
          <button className="btn btn-primary">Paylaş</button>
        </form>
      )}
      <div className="space-y-3">
        {items.map((d) => (
          <article key={d.id} className="card p-5">
            <div className="text-xs text-slate-500">{d.kind} · {d.author.name} · {formatTrDateTime(d.createdAt)}</div>
            <h2 className="font-semibold">{d.title}</h2>
            <p className="text-sm mt-1 whitespace-pre-wrap">{d.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
