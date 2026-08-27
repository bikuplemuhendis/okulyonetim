import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteSchedule, saveSchedule } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { DAY_LABELS } from "@/lib/time";
import { scopedBranches } from "@/lib/services";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { WeeklyGrid } from "@/components/sis-ui";
import Link from "next/link";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const where = tenantFilter(actor);
  const teacherFilter = actor.role === "TEACHER" ? { teacherId: actor.id } : {};
  const rows = await prisma.lessonSchedule.findMany({
    where: {
      ...where,
      ...teacherFilter,
      ...(!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role) && actor.branchIds.length
        ? { branchId: { in: actor.branchIds } }
        : {}),
    },
    include: { classroom: true, course: true, teacher: true, location: true, branch: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  const branches = await scopedBranches(actor);
  const classrooms = await prisma.classroom.findMany({ where });
  const courses = await prisma.course.findMany({ where });
  const teachers = await prisma.user.findMany({ where: { ...where, role: "TEACHER" } });
  const locations = await prisma.location.findMany({ where });
  const editing = rows.find((r) => r.id === sp.edit);
  return (
    <div>
      <PageHeader
        title="Haftalık ders programı"
        subtitle="Gün, saat, ders, öğretmen, sınıf, lokasyon. Aynı lokasyonda çakışma kontrolü kayıtta uygulanır."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <WeeklyGrid
        rows={rows.map((r) => ({
          id: r.id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          course: r.course.name,
          classroom: r.classroom.name,
          teacher: r.teacher.name,
          location: r.location.name,
        }))}
      />
      {actor.role !== "TEACHER" ? (
        <form action={saveSchedule} className="card p-5 mb-6 grid md:grid-cols-4 gap-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <select className="select" name="branchId" defaultValue={editing?.branchId}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select" name="classroomId" defaultValue={editing?.classroomId}>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="courseId" defaultValue={editing?.courseId}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="teacherId" defaultValue={editing?.teacherId}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="select" name="locationId" defaultValue={editing?.locationId}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select className="select" name="dayOfWeek" defaultValue={editing ? String(editing.dayOfWeek) : "1"}>
            {DAY_LABELS.slice(1).map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
          <input className="input" type="time" name="startTime" required defaultValue={editing?.startTime} />
          <input className="input" type="time" name="endTime" required defaultValue={editing?.endTime} />
          <button className="btn btn-primary">{editing ? "Güncelle" : "Slot ekle"}</button>
          {editing ? (
            <Link className="btn btn-ghost" href="/panel/program">
              Vazgeç
            </Link>
          ) : null}
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
                    <div className="flex gap-3">
                      <Link className="text-kampus-700 text-xs" href={`/panel/program?edit=${r.id}`}>
                        Düzenle
                      </Link>
                      <ConfirmDelete action={deleteSchedule} id={r.id} />
                    </div>
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
