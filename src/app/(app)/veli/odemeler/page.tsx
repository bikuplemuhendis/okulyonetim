import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { ChildSwitcher } from "@/components/sis-ui";
import { parentStudents, studentBalance } from "@/lib/sis-service";
import { INVOICE_STATUS_LABELS, formatTry, invoiceBalance } from "@/lib/sis";
import { dateInputValue } from "@/components/flash";
import { redirect } from "next/navigation";

export default async function ParentPayments({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await parentStudents(actor);
  const sp = await searchParams;
  const student = links.find((l) => l.studentId === sp.child)?.student ?? links[0]?.student;
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const invoices = await prisma.invoice.findMany({
    where: { studentId: student.id },
    include: { payments: true },
    orderBy: { dueDate: "desc" },
  });
  const total = studentBalance(invoices);
  return (
    <div>
      <PageHeader title="Ödeme durumu" subtitle={`${student.name} — kalan borç ${formatTry(total)}. Tahsilat okulda kaydedilir.`} />
      <ChildSwitcher items={links.map((l) => ({ id: l.studentId, name: l.student.name }))} currentId={student.id} />
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
