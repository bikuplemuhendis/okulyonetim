import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { submitExcuse } from "@/app/actions";
import { clock } from "@/lib/time";
import { redirect } from "next/navigation";

const color: Record<string, string> = {
  ABSENT: "bg-red-200",
  LATE: "bg-amber-200",
  EXCUSED: "bg-sky-200",
  PRESENT: "bg-emerald-100",
};

export default async function ParentAbsences() {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await prisma.parentStudent.findMany({
    where: { parentId: actor.id },
    include: {
      student: {
        include: {
          attendance: { include: { session: { include: { schedule: { include: { course: true } } } } } },
        },
      },
    },
  });
  const student = links[0]?.student;
  if (!student) return <p>Öğrenci yok.</p>;
  const byDate = new Map<string, typeof student.attendance>();
  for (const a of student.attendance) {
    const list = byDate.get(a.session.date) ?? [];
    list.push(a);
    byDate.set(a.session.date, list);
  }
  return (
    <div>
      <PageHeader title="Devamsızlık takvimi" subtitle={`${student.name} — kırmızı gelmedi, sarı geç, mavi mazeretli.`} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-2">
          {[...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, rows]) => {
            const worst = rows.some((r) => r.status === "ABSENT")
              ? "ABSENT"
              : rows.some((r) => r.status === "LATE")
                ? "LATE"
                : rows.some((r) => r.status === "EXCUSED")
                  ? "EXCUSED"
                  : "PRESENT";
            return (
              <details key={date} className={`rounded-xl p-3 ${color[worst]}`}>
                <summary className="cursor-pointer font-medium">
                  {date} · {worst}
                </summary>
                <ul className="text-sm mt-2">
                  {rows.map((r) => (
                    <li key={r.id}>
                      {r.session.schedule.course.name}: {r.status}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
        <form action={submitExcuse} className="card p-5 space-y-3">
          <h2 className="font-semibold">Mazeret bildir</h2>
          <input type="hidden" name="studentId" value={student.id} />
          <input className="input" type="date" name="date" defaultValue={clock().dateStr} required />
          <textarea className="textarea" name="reason" required placeholder="Gerekçe" />
          <button className="btn btn-primary">Gönder</button>
        </form>
      </div>
    </div>
  );
}
