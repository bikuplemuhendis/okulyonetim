import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { tenantFilter } from "@/lib/rbac";
import { formatTrDateTime } from "@/lib/time";

export default async function NotificationsPage() {
  const actor = await requireActor();
  const rows = await prisma.notificationRecord.findMany({
    where: tenantFilter(actor),
    include: { student: true, template: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <PageHeader title="Gönderim kayıtları" subtitle="SMS/Push/e-posta teslim simülasyonu ve sessiz saat SUPPRESSED kayıtları." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Öğrenci</th>
              <th>Alıcı</th>
              <th>Kanal</th>
              <th>Durum</th>
              <th>Gövde</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTrDateTime(r.createdAt)}</td>
                <td>{r.student?.name}</td>
                <td>{r.recipient}</td>
                <td>{r.channel}</td>
                <td>{r.status}</td>
                <td className="max-w-sm">{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
