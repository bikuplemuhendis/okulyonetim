import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteSchedule, saveSchedule } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { DAY_LABELS } from "@/lib/time";
import { scopedBranches } from "@/lib/services";

export default async function SchedulePage() {
  const actor = await requireActor();
  const where = tenantFilter(actor);
  const teacherFilter = actor.role === "TEACHER" ? { teacherId: actor.id } : {};
  const rows = await prisma.lessonSchedule.findMany({
    where: { ...where, ...teacherFilter },
    include: { classroom: true, course: true, teacher: true, location: true, branch: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  const branches = await scopedBranches(actor);
  const classrooms = await prisma.classroom.findMany({ where });
  const courses = await prisma.course.findMany({ where });
  const teachers = await prisma.user.findMany({ where: { ...where, role: "TEACHER" } });
  const locations = await prisma.location.findMany({ where });
  return (
    <div>
      <PageHeader title="Haftalık ders programı" subtitle="Gün, saat, ders, öğretmen, sınıf, lokasyon. Aynı lokasyonda çakışma kontrolü import’ta uygulanır." />
      {actor.role !== "TEACHER" ? (
        <form action={saveSchedule} className="card p-5 mb-6 grid md:grid-cols-4 gap-3">
          <select className="select" name="branchId">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select" name="classroomId">
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="courseId">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="teacherId">
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="select" name="locationId">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select className="select" name="dayOfWeek">
            {DAY_LABELS.slice(1).map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
          <input className="input" type="time" name="startTime" required />
          <input className="input" type="time" name="endTime" required />
          <button className="btn btn-primary">Slot ekle</button>
        </form>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Gün</th>
              <th>Saat</th>
              <th>Şube / Sınıf</th>
              <th>Ders</th>
              <th>Öğretmen</th>
              <th>Lokasyon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{DAY_LABELS[r.dayOfWeek]}</td>
                <td>
                  {r.startTime}–{r.endTime}
                </td>
                <td>
                  {r.branch.code} / {r.classroom.name}
                </td>
                <td>{r.course.name}</td>
                <td>{r.teacher.name}</td>
                <td>{r.location.name}</td>
                <td>
                  {actor.role !== "TEACHER" ? (
                    <form action={deleteSchedule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-red-700 text-xs">Sil</button>
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
