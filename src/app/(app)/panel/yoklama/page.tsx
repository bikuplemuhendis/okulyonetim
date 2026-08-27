import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { startSessionAction } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { clock } from "@/lib/time";
import Link from "next/link";

export default async function SessionsPage() {
  const actor = await requireActor();
  const today = clock().dateStr;
  const teacherWhere = actor.role === "TEACHER" ? { teacherId: actor.id } : {};
  const schedules = await prisma.lessonSchedule.findMany({
    where: { ...tenantFilter(actor), ...teacherWhere, dayOfWeek: clock().weekdayMon1 },
    include: { course: true, classroom: true, location: true, teacher: true },
    orderBy: { startTime: "asc" },
  });
  const sessions = await prisma.lessonSession.findMany({
    where: { ...tenantFilter(actor), ...teacherWhere },
    include: { schedule: { include: { course: true, classroom: true } }, attendance: true },
    orderBy: { date: "desc" },
    take: 30,
  });
  return (
    <div>
      <PageHeader
        title="Dijital sınıf defteri"
        subtitle="RFID kart okutma yerine öğretmen oturumu başlatır; yoklama web’den finalize edilir."
      />
      <h2 className="font-semibold mb-2">Bugünün programı ({today})</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {schedules.map((s) => (
          <div key={s.id} className="card p-4 flex justify-between gap-3">
            <div>
              <div className="font-medium">
                {s.startTime}–{s.endTime} · {s.course.name}
              </div>
              <div className="text-sm text-slate-600">
                {s.classroom.name} · {s.location.name} · {s.teacher.name}
              </div>
            </div>
            <form action={startSessionAction}>
              <input type="hidden" name="scheduleId" value={s.id} />
              <input type="hidden" name="date" value={today} />
              <button className="btn btn-primary">Oturumu başlat</button>
            </form>
          </div>
        ))}
        {!schedules.length ? <p className="text-sm text-slate-500">Bugün program yok.</p> : null}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Ders</th>
              <th>Durum</th>
              <th>Katılım</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>
                  {s.schedule.course.name} / {s.schedule.classroom.name}
                </td>
                <td>{s.status}</td>
                <td>
                  {s.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length}/
                  {s.attendance.length}
                </td>
                <td>
                  <Link className="text-kampus-700" href={`/panel/yoklama/${s.id}`}>
                    Defter
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
