import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant, dateInputValue } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteFeeTypeAction, saveFeeType, saveInvoice } from "@/app/sis-actions";
import { canManageFinance, tenantFilter } from "@/lib/rbac";
import { FEE_PERIOD_LABELS, INVOICE_STATUS_LABELS, formatTry, invoiceBalance } from "@/lib/sis";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; editFee?: string }>;
}) {
  const actor = await requireActor();
  if (!canManageFinance(actor.role) && actor.role !== "COUNSELOR") redirect("/panel");
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const feeTypes = await prisma.feeType.findMany({ where: tenantFilter(actor), orderBy: { name: "asc" } });
  const invoices = await prisma.invoice.findMany({
    where: {
      ...tenantFilter(actor),
      ...(!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)
        ? { branchId: { in: actor.branchIds } }
        : {}),
    },
    include: { student: true, payments: true, feeType: true },
    orderBy: { dueDate: "desc" },
    take: 80,
  });
  const students = await prisma.student.findMany({
    where: {
      ...tenantFilter(actor),
      status: "ACTIVE",
      ...(!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role)
        ? { branchId: { in: actor.branchIds } }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  const editing = feeTypes.find((f) => f.id === sp.editFee);
  const can = canManageFinance(actor.role);
  return (
    <div>
      <PageHeader title="Ücret ve tahsilat" subtitle="Ücret türleri, fatura (borç) ve tahsilat kaydı. Banka bağlantısı yok." />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <form action={saveFeeType} className="card p-5 grid gap-3">
            <h2 className="font-semibold">{editing ? "Ücret türünü düzenle" : "Ücret türü"}</h2>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <input className="input" name="name" placeholder="Eğitim ücreti" required defaultValue={editing?.name ?? ""} />
            <input className="input" name="amount" type="number" step="0.01" required defaultValue={String(editing?.amount ?? "")} />
            <select className="select" name="period" defaultValue={editing?.period ?? "TERM"}>
              {Object.entries(FEE_PERIOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input className="input" name="description" placeholder="Açıklama" defaultValue={editing?.description ?? ""} />
            <select className="select" name="status" defaultValue={editing?.status ?? "ACTIVE"}>
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
            </select>
            <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
          </form>
          <form action={saveInvoice} className="card p-5 grid gap-3">
            <h2 className="font-semibold">Yeni fatura / borç</h2>
            <select className="select" name="studentId" required>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.studentNo})
                </option>
              ))}
            </select>
            <select className="select" name="feeTypeId">
              <option value="">Türe bağlı değil</option>
              {feeTypes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {formatTry(f.amount)}
                </option>
              ))}
            </select>
            <input className="input" name="title" required placeholder="2026-2027 1. dönem eğitim" />
            <input className="input" name="amount" type="number" step="0.01" required />
            <input className="input" type="date" name="dueDate" required />
            <input className="input" name="note" placeholder="Not" />
            <button className="btn btn-primary">Fatura kes</button>
          </form>
        </div>
      ) : null}
      <div className="card overflow-x-auto mb-6">
        <h2 className="font-semibold p-4 pb-0">Ücret türleri</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Tutar</th>
              <th>Periyot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {feeTypes.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{formatTry(f.amount)}</td>
                <td>{FEE_PERIOD_LABELS[f.period]}</td>
                <td className="flex gap-3">
                  {can ? (
                    <>
                      <Link className="text-kampus-700 text-xs" href={`/panel/ucretler?editFee=${f.id}`}>
                        Düzenle
                      </Link>
                      <ConfirmDelete action={deleteFeeTypeAction} id={f.id} />
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="font-semibold p-4 pb-0">Faturalar</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Başlık</th>
              <th>Tutar / bakiye</th>
              <th>Vade</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.student.name}</td>
                <td>{i.title}</td>
                <td>
                  {formatTry(i.amount)} / {formatTry(invoiceBalance(i.amount, i.payments))}
                </td>
                <td>{dateInputValue(i.dueDate)}</td>
                <td>{INVOICE_STATUS_LABELS[i.status]}</td>
                <td>
                  <Link className="text-kampus-700 text-xs" href={`/panel/ucretler/${i.id}`}>
                    Tahsilat
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
