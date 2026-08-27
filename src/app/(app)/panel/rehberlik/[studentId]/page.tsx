import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveCounseling } from "@/app/actions";
import { notFound } from "next/navigation";
import { canViewCounseling } from "@/lib/domain";
import { loadTenant, maskForActor } from "@/lib/services";
import { formatTrDateTime } from "@/lib/time";

export default async function Student360({ params }: { params: Promise<{ studentId: string }> }) {
  const actor = await requireActor();
  const { studentId } = await params;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      classroom: true,
      branch: true,
      parents: { include: { parent: true } },
      attendance: true,
      checkIns: { orderBy: { timestamp: "desc" }, take: 10 },
      counseling: { include: { counselor: true }, orderBy: { occurredAt: "desc" } },
      incidents: true,
    },
  });
  if (!student) notFound();
  const tenant = await loadTenant(actor);
  const absences = student.attendance.filter((a) => a.status === "ABSENT").length;
  const lates = student.attendance.filter((a) => a.status === "LATE").length;
  const present = student.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const parent = student.parents[0]?.parent;
  const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", { phone: parent?.phone, email: parent?.email });
  return (
    <div>
      <PageHeader title={`360° ${student.name}`} subtitle={`${student.classroom.name} · ${student.studentNo}`} />
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Kimlik</h2>
          <p>Sınıf: {student.classroom.name}</p>
          <p>Şube: {student.branch.name}</p>
          <p>Veli: {parent?.name ?? "—"} · {masked.phone}</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Akademik özet (V1)</h2>
          <p>Katılım kaydı: {present}</p>
          <p>Devamsızlık: {absences}</p>
          <p>Geç kalma: {lates}</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Davranışsal özet</h2>
          <p>İstisna: {student.incidents.length}</p>
          <p>Kütüphane check-in: {student.checkIns.filter((c) => c.kind === "LIBRARY").length}</p>
          <p>Görüşme: {student.counseling.length}</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <form action={saveCounseling} className="card p-5 space-y-3">
          <h2 className="font-semibold">Görüşme kaydı</h2>
          <input type="hidden" name="studentId" value={student.id} />
          <input className="input" type="datetime-local" name="occurredAt" required />
          <select className="select" name="topic" required>
            <option>Ders Başarısı</option>
            <option>Devamsızlık</option>
            <option>Davranış</option>
            <option>Aile</option>
            <option>Diğer</option>
          </select>
          <textarea className="textarea" name="notes" required maxLength={2000} placeholder="Görüşme notu" />
          <select className="select" name="privacy" defaultValue="MEDIUM">
            <option value="LOW">Düşük</option>
            <option value="MEDIUM">Orta</option>
            <option value="HIGH">Yüksek (yalnızca rehberlik)</option>
          </select>
          <textarea className="textarea" name="actionPlan" placeholder="Aksiyon planı (ops.)" />
          <input className="input" type="date" name="nextMeeting" />
          <button className="btn btn-primary">Kaydet</button>
        </form>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Geçmiş görüşmeler</h2>
          <ul className="space-y-3 text-sm">
            {student.counseling.map((c) => {
              const visible = canViewCounseling({ role: actor.role, privacy: c.privacy });
              return (
                <li key={c.id} className="border-b border-slate-100 pb-2">
                  <div className="font-medium">
                    {c.topic} · {c.privacy} · {formatTrDateTime(c.occurredAt)}
                  </div>
                  {visible ? (
                    <>
                      <p>{c.notes}</p>
                      {c.actionPlan ? <p className="text-slate-600">Plan: {c.actionPlan}</p> : null}
                    </>
                  ) : (
                    <p className="text-slate-500">Gizlilik nedeniyle gizli.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
