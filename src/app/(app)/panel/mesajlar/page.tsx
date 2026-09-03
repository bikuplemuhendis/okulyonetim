import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { sendMessageAction } from "@/app/sis-actions";
import { formatTrDateTime } from "@/lib/time";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const items = await prisma.inboxMessage.findMany({
    where: tenantFilter(actor),
    include: { sender: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return (
    <div>
      <PageHeader title="Mesajlar" subtitle="Öğretmen–veli–öğrenci inbox; okundu bilgisi ve öğrenci bağlamı." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={sendMessageAction} className="card p-5 grid gap-3 mb-6">
        <select className="select" name="recipientRole">
          <option value="PARENT">Veliler</option>
          <option value="TEACHER">Öğretmenler</option>
          <option value="STUDENT">Öğrenciler</option>
          <option value="BRANCH_OPS">Sekreterlik</option>
        </select>
        <select className="select" name="studentId">
          <option value="">Öğrenci bağlamı yok</option>
          {lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input" name="subject" placeholder="Konu" required />
        <textarea className="textarea" name="body" placeholder="Mesaj" required />
        <button className="btn btn-primary">Gönder</button>
      </form>
      <div className="space-y-3">
        {items.map((m) => (
          <article key={m.id} className="card p-5">
            <div className="text-xs text-slate-500">{formatTrDateTime(m.createdAt)} · {m.sender.name} → {m.recipientRole}</div>
            <h2 className="font-semibold">{m.subject}</h2>
            <p className="text-sm mt-1">{m.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
