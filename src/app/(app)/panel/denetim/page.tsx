import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { tenantFilter } from "@/lib/rbac";
import { formatTrDateTime } from "@/lib/time";

export default async function AuditPage() {
  const actor = await requireActor();
  const logs = await prisma.auditLog.findMany({
    where: actor.role === "PLATFORM_SUPER_ADMIN" ? {} : tenantFilter(actor),
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return (
    <div>
      <PageHeader title="Denetim izi" subtitle="Kritik işlemler: yoklama düzeltme, rol, toplu bildirim, oturum." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Aktör</th>
              <th>Aksiyon</th>
              <th>Varlık</th>
              <th>Sonuç</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{formatTrDateTime(l.createdAt)}</td>
                <td>{l.actor?.name ?? "sistem"}</td>
                <td>{l.action}</td>
                <td>
                  {l.entityType} {l.entityId?.slice(0, 8)}
                </td>
                <td>{l.result}</td>
                <td>{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
