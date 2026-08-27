import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { WeeklyGrid } from "@/components/sis-ui";
import { requireOwnStudent } from "@/lib/sis-service";
import { redirect } from "next/navigation";

export default async function StudentSchedule() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT") redirect("/panel");
  const student = await requireOwnStudent(actor);
  const rows = await prisma.lessonSchedule.findMany({
    where: { classroomId: student.classroomId },
    include: { course: true, teacher: true, location: true, classroom: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return (
    <div>
      <PageHeader title="Haftalık programım" subtitle={`${student.classroom.name}`} />
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
    </div>
  );
}
