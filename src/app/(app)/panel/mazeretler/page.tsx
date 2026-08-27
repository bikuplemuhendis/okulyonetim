import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { reviewExcuse } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";

export default async function ExcusesPage() {
  const actor = await requireActor();
  const rows = await prisma.excuseRequest.findMany({
    where: tenantFilter(actor),
    include: { student: { include: { classroom: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Mazeretler" subtitle="Veli bildirimi şube paneline düşer; onay yoklamayı EXCUSED yapar." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Öğrenci</th>
              <th>Gerekçe</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>
                  {r.student.name} / {r.student.classroom.name}
                </td>
                <td>{r.reason}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "PENDING" ? (
                    <form action={reviewExcuse} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn btn-primary" name="status" value="APPROVED">
                        Onayla
                      </button>
                      <button className="btn btn-ghost" name="status" value="REJECTED">
                        Reddet
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
