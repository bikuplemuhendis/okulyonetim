import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter, canExport } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { payFeeAction, saveFeeAction } from "@/app/sis-actions";
import { remainingFee } from "@/lib/sis";
import { redirect } from "next/navigation";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  if (!canExport(actor.role) && actor.role !== "BRANCH_OPS") redirect("/panel");
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const fees = await prisma.feeCharge.findMany({
    where: tenantFilter(actor),
    include: { student: true },
    orderBy: { dueDate: "asc" },
  });
  const open = fees.reduce((s, f) => s + remainingFee(f.amount, f.paid), 0);
  return (
    <div>
      <PageHeader title="Ücret / kasa" subtitle={`Açık bakiye ₺${open.toLocaleString("tr-TR")}. POS sonraki faz; veli portalından simüle tahsilat.`} />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <form action={saveFeeAction} className="card p-5 grid gap-3">
          <select className="select" name="branchId" required>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className="input" name="title" placeholder="2026-2027 kayıt ücreti" required />
          <input className="input" name="amount" type="number" step="0.01" required />
          <input className="input" name="dueDate" type="date" required />
          <button className="btn btn-primary">Borç oluştur</button>
        </form>
        <form action={payFeeAction} className="card p-5 grid gap-3">
          <select className="select" name="feeId" required>{fees.map((f) => <option key={f.id} value={f.id}>{f.student.name} · {f.title}</option>)}</select>
          <input className="input" name="amount" type="number" step="0.01" required />
          <button className="btn btn-accent">Tahsil et</button>
        </form>
      </div>
      <table className="table card">
        <thead><tr><th>Öğrenci</th><th>Kalem</th><th>Tutar</th><th>Ödenen</th><th>Kalan</th><th>Durum</th></tr></thead>
        <tbody>
          {fees.map((f) => (
            <tr key={f.id}>
              <td>{f.student.name}</td>
              <td>{f.title}<div className="text-xs text-slate-500">{f.dueDate}</div></td>
              <td>{f.amount}</td>
              <td>{f.paid}</td>
              <td>{remainingFee(f.amount, f.paid)}</td>
              <td>{f.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
