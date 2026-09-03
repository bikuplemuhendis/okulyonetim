import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { redirect } from "next/navigation";
import { tenantFilter } from "@/lib/rbac";
import { sendMessageAction } from "@/app/sis-actions";
import { formatTrDateTime } from "@/lib/time";
import { parentChildren } from "@/lib/parent-child";

export default async function ParentInbox({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const sp = await searchParams;
  const { student } = await parentChildren(actor, sp.child);
  const items = await prisma.inboxMessage.findMany({
    where: { ...tenantFilter(actor), recipientRole: { in: ["PARENT", "STUDENT"] } },
    include: { sender: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Mesajlar" />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={sendMessageAction} className="card p-5 grid gap-3 mb-6">
        <input type="hidden" name="recipientRole" value="TEACHER" />
        {student ? <input type="hidden" name="studentId" value={student.id} /> : null}
        <input className="input" name="subject" placeholder="Konu" required />
        <textarea className="textarea" name="body" required />
        <button className="btn btn-primary">Öğretmene yaz</button>
      </form>
      <div className="space-y-3">
        {items.map((m) => (
          <article key={m.id} className="card p-5">
            <div className="text-xs text-slate-500">{formatTrDateTime(m.createdAt)} · {m.sender.name}</div>
            <h2 className="font-semibold">{m.subject}</h2>
            <p className="text-sm">{m.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
