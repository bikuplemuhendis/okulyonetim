import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, dateInputValue } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { cancelInvoiceAction, deletePaymentAction, recordPaymentAction, saveInvoice } from "@/app/sis-actions";
import { assertBranch, assertTenant, canManageFinance } from "@/lib/rbac";
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatTry, invoiceBalance } from "@/lib/sis";
import { formatTrDateTime } from "@/lib/time";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function InvoiceDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { student: true, payments: { include: { recordedBy: true }, orderBy: { paidAt: "desc" } }, feeType: true },
  });
  if (!invoice) notFound();
  try {
    assertTenant(actor, invoice.tenantId);
    assertBranch(actor, invoice.branchId);
  } catch {
    notFound();
  }
  const can = canManageFinance(actor.role);
  const remaining = invoiceBalance(invoice.amount, invoice.payments);
  return (
    <div>
      <PageHeader
        title={invoice.title}
        subtitle={`${invoice.student.name} · ${INVOICE_STATUS_LABELS[invoice.status]} · kalan ${formatTry(remaining)}`}
        actions={
          <Link className="btn btn-ghost" href="/panel/ucretler">
            Liste
          </Link>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <form action={saveInvoice} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          <input type="hidden" name="id" value={invoice.id} />
          <input type="hidden" name="studentId" value={invoice.studentId} />
          <input type="hidden" name="feeTypeId" value={invoice.feeTypeId ?? ""} />
          <input className="input md:col-span-2" name="title" defaultValue={invoice.title} required />
          <input className="input" name="amount" type="number" step="0.01" defaultValue={String(invoice.amount)} required />
          <input className="input" type="date" name="dueDate" defaultValue={dateInputValue(invoice.dueDate)} required />
          <input className="input" name="note" defaultValue={invoice.note ?? ""} />
          <button className="btn btn-primary">Faturayı güncelle</button>
        </form>
      ) : null}
      {can && invoice.status !== "CANCELLED" && remaining > 0 ? (
        <form action={recordPaymentAction} className="card p-5 mb-6 grid md:grid-cols-4 gap-3">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <input className="input" name="amount" type="number" step="0.01" max={remaining} required placeholder="Tutar" />
          <select className="select" name="method">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className="input" type="datetime-local" name="paidAt" />
          <input className="input" name="note" placeholder="Makbuz / açıklama" />
          <button className="btn btn-primary">Tahsilat kaydet</button>
        </form>
      ) : null}
      {can && invoice.status !== "CANCELLED" && invoice.payments.length === 0 ? (
        <form action={cancelInvoiceAction} className="mb-6">
          <input type="hidden" name="id" value={invoice.id} />
          <button className="btn btn-ghost">Faturayı iptal et</button>
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tutar</th>
              <th>Yöntem</th>
              <th>Kayıt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoice.payments.map((p) => (
              <tr key={p.id}>
                <td>{formatTrDateTime(p.paidAt)}</td>
                <td>{formatTry(p.amount)}</td>
                <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td>
                  {p.recordedBy.name}
                  {p.note ? ` · ${p.note}` : ""}
                </td>
                <td>
                  {can ? <ConfirmDelete action={deletePaymentAction} id={p.id} extra={{ invoiceId: invoice.id }} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
