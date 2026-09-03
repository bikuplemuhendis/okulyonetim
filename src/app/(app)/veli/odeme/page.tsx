import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";
import { remainingFee, student360 } from "@/lib/sis";
import { payFeeAction } from "@/app/sis-actions";

export default async function ParentPay({ searchParams }: { searchParams: Promise<{ child?: string; ok?: string; err?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const sp = await searchParams;
  const { student } = await parentChildren(actor, sp.child);
  if (!student) return <p>Öğrenci yok.</p>;
  const snap = await student360(actor, student.id);
  return (
    <div>
      <PageHeader title="Ödemeler" subtitle="Simüle tahsilat (POS sonraki faz). Gecikmiş satırlar kırmızı." />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="space-y-3">
        {snap?.student.fees.map((f) => (
          <article key={f.id} className="card p-5 flex flex-wrap justify-between gap-3">
            <div>
              <div className="font-semibold">{f.title}</div>
              <p className="text-sm text-slate-500">₺{remainingFee(f.amount, f.paid)} kalan · {f.status} · {f.dueDate}</p>
            </div>
            {f.status !== "PAID" ? (
              <form action={payFeeAction} className="flex gap-2">
                <input type="hidden" name="feeId" value={f.id} />
                <input className="input w-28" name="amount" type="number" step="0.01" defaultValue={remainingFee(f.amount, f.paid)} />
                <button className="btn btn-accent">Öde</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
