import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { teacherClassroomIds } from "@/lib/sis-service";
import { DAY_LABELS } from "@/lib/time";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MyClassesPage() {
  const actor = await requireActor();
  if (actor.role !== "TEACHER") redirect("/panel");
  const classIds = await teacherClassroomIds(actor);
  const classrooms = await prisma.classroom.findMany({
    where: { id: { in: classIds } },
    include: { students: { where: { status: "ACTIVE" } }, schedules: { include: { course: true, location: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader title="Sınıflarım" subtitle="Programınızdaki sınıflar, öğrenciler ve haftalık slotlar." />
      <div className="space-y-4">
        {classrooms.map((c) => (
          <section key={c.id} className="card p-5">
            <div className="flex justify-between gap-3 mb-3">
              <h2 className="font-semibold">{c.name}</h2>
              <div className="flex gap-2 text-sm">
                <Link className="text-kampus-700" href={`/panel/notlar?classroomId=${c.id}`}>
                  Not defteri
                </Link>
                <Link className="text-kampus-700" href={`/panel/yoklama`}>
                  Yoklama
                </Link>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-2">{c.students.length} öğrenci</p>
            <ul className="text-sm mb-3 columns-2">
              {c.students.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
            <ul className="text-xs text-slate-600 space-y-1">
              {c.schedules
                .filter((s) => s.teacherId === actor.id)
                .map((s) => (
                  <li key={s.id}>
                    {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime} · {s.course.name} · {s.location.name}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
