import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { requireOwnStudent, studentBalance } from "@/lib/sis-service";
import { INVOICE_STATUS_LABELS, formatTry, invoiceBalance } from "@/lib/sis";
import { dateInputValue } from "@/components/flash";
import { redirect } from "next/navigation";

export default async function StudentPayments() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const invoices = await prisma.invoice.findMany({
    where: { studentId: student.id },
    include: { payments: true },
    orderBy: { dueDate: "desc" },
  });
  return (
    <div>
      <PageHeader title="Ödeme durumu" subtitle={`Kalan borç ${formatTry(studentBalance(invoices))}`} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Tutar</th>
              <th>Kalan</th>
              <th>Vade</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.title}</td>
                <td>{formatTry(i.amount)}</td>
                <td>{formatTry(invoiceBalance(i.amount, i.payments))}</td>
                <td>{dateInputValue(i.dueDate)}</td>
                <td>{INVOICE_STATUS_LABELS[i.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
