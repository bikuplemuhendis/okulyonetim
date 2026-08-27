import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { tenantFilter } from "@/lib/rbac";
import Link from "next/link";

export default async function GuidanceList() {
  const actor = await requireActor();
  const students = await prisma.student.findMany({
    where: {
      ...tenantFilter(actor),
      status: "ACTIVE",
      ...(!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role) && actor.branchIds.length
        ? { branchId: { in: actor.branchIds } }
        : {}),
    },
    include: { classroom: true, _count: { select: { counseling: true, incidents: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader title="Rehberlik" subtitle="Öğrenci 360° profil ve görüşme kayıtları. RFID oda okutması yerine listeden seçim." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>Görüşme</th>
              <th>İstisna</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link className="text-kampus-700 font-medium" href={`/panel/rehberlik/${s.id}`}>
                    {s.name}
                  </Link>
                </td>
                <td>{s.classroom.name}</td>
                <td>{s._count.counseling}</td>
                <td>{s._count.incidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
