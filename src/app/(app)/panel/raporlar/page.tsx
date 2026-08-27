import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { tenantFilter } from "@/lib/rbac";
import { loadTenant, maskForActor } from "@/lib/services";

export default async function ReportsPage() {
  const actor = await requireActor();
  const tenant = await loadTenant(actor);
  const byClass = await prisma.classroom.findMany({
    where: tenantFilter(actor),
    include: {
      students: {
        include: { attendance: true },
      },
      branch: true,
    },
  });
  const rows = byClass.map((c) => {
    const att = c.students.flatMap((s) => s.attendance);
    return {
      name: `${c.branch.code} / ${c.name}`,
      students: c.students.length,
      absent: att.filter((a) => a.status === "ABSENT").length,
      late: att.filter((a) => a.status === "LATE").length,
      present: att.filter((a) => a.status === "PRESENT").length,
    };
  });
  const absentees = await prisma.attendance.findMany({
    where: { status: "ABSENT", session: tenantFilter(actor) },
    include: { student: { include: { parents: { include: { parent: true } }, classroom: true } }, session: true },
    take: 50,
    orderBy: { markedAt: "desc" },
  });
  return (
    <div>
      <PageHeader
        title="Raporlar"
        subtitle="Sınıf kırılımı, yoklama özeti ve KVKK maskeli dışa aktarım."
        actions={
          <a className="btn btn-ghost" href="/api/reports/students.csv">
            Öğrenci CSV
          </a>
        }
      />
      <div className="card overflow-x-auto mb-6">
        <table className="table">
          <thead>
            <tr>
              <th>Sınıf</th>
              <th>Öğrenci</th>
              <th>Mevcut</th>
              <th>Geç</th>
              <th>Yok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.students}</td>
                <td>{r.present}</td>
                <td>{r.late}</td>
                <td>{r.absent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="font-semibold mb-2">Devamsızlık listesi</h2>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>Veli</th>
            </tr>
          </thead>
          <tbody>
            {absentees.map((a) => {
              const p = a.student.parents[0]?.parent;
              const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", { phone: p?.phone, email: p?.email });
              return (
                <tr key={a.id}>
                  <td>{a.session.date}</td>
                  <td>{a.student.name}</td>
                  <td>{a.student.classroom.name}</td>
                  <td>{masked.phone}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
