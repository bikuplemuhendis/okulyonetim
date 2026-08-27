import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { bulkNotifyAction, closeIncident } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { loadTenant, maskForActor } from "@/lib/services";
import { formatTrDateTime } from "@/lib/time";

export default async function IncidentsPage() {
  const actor = await requireActor();
  const tenant = await loadTenant(actor);
  const incidents = await prisma.incident.findMany({
    where: tenantFilter(actor),
    include: { student: { include: { classroom: true, parents: { include: { parent: true } } } }, location: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const templates = await prisma.notificationTemplate.findMany({
    where: { tenantId: actor.tenantId ?? undefined, status: "ACTIVE" },
  });
  const absences = incidents.filter((i) => i.type === "ABSENCE" && i.status === "OPEN");
  return (
    <div>
      <PageHeader
        title="İstisna ve olay yönetimi"
        subtitle="Yoklama kaçağı, geç kalanlar, yetkisiz/plan dışı web check-in. Toplu veli bildirimi şablonla gider."
      />
      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-2">Toplu veli bilgilendirme</h2>
        <form action={bulkNotifyAction} className="grid md:grid-cols-2 gap-3">
          <input
            type="hidden"
            name="studentIds"
            value={absences.map((i) => i.studentId).filter(Boolean).join(",")}
          />
          <select className="select" name="templateId" required>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.channel})
              </option>
            ))}
          </select>
          <div className="text-sm">
            {["IN_APP", "PUSH", "SMS"].map((c) => (
              <label key={c} className="mr-3">
                <input type="checkbox" name="channels" value={c} defaultChecked={c !== "SMS"} /> {c}
              </label>
            ))}
          </div>
          <textarea className="textarea md:col-span-2" name="body" placeholder="Şablon gövdesini override (ops.)" />
          <label className="text-sm md:col-span-2">
            <input type="checkbox" required /> {absences.length} alıcı için gönderimi onaylıyorum
          </label>
          <button className="btn btn-accent">Gönder (simülasyon)</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Tip</th>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>Veli</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => {
              const phone = i.student?.parents[0]?.parent.phone;
              const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", { phone });
              return (
                <tr key={i.id}>
                  <td>{formatTrDateTime(i.createdAt)}</td>
                  <td>{i.type}</td>
                  <td>{i.student?.name ?? "—"}</td>
                  <td>{i.student?.classroom.name}</td>
                  <td>{masked.phone}</td>
                  <td>{i.status}</td>
                  <td>
                    <form action={closeIncident} className="flex gap-1">
                      <input type="hidden" name="id" value={i.id} />
                      <select className="select" name="status" defaultValue="CLOSED">
                        <option value="CLASSIFIED">Sınıflandır</option>
                        <option value="ACTIONED">Aksiyon</option>
                        <option value="CLOSED">Kapat</option>
                      </select>
                      <button className="btn btn-ghost">OK</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
