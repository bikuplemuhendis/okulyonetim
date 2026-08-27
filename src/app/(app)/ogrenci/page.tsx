import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import Link from "next/link";
import { SelfCheckInButton } from "@/components/checkin";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function StudentHome() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT" || !actor.studentId) redirect("/panel");
  const student = await prisma.student.findUnique({
    where: { id: actor.studentId },
    include: {
      classroom: true,
      attendance: { include: { session: { include: { schedule: { include: { course: true } } } } }, take: 15, orderBy: { markedAt: "desc" } },
      checkIns: { include: { location: true }, orderBy: { timestamp: "desc" }, take: 15 },
    },
  });
  if (!student) return <p>Kayıt yok.</p>;
  return (
    <div>
      <PageHeader title={`Merhaba ${student.name}`} subtitle={`${student.classroom.name} · web yoklama ile derse katılın.`} />
      <div className="card p-5 mb-6">
        <SelfCheckInButton />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <Link className="btn btn-ghost" href="/ogrenci/program">
          Program
        </Link>
        <Link className="btn btn-ghost" href="/ogrenci/notlar">
          Notlar
        </Link>
        <Link className="btn btn-ghost" href="/ogrenci/odevler">
          Ödevler
        </Link>
        <Link className="btn btn-ghost" href="/ogrenci/materyaller">
          Materyaller
        </Link>
        <Link className="btn btn-ghost" href="/ogrenci/odemeler">
          Ödeme
        </Link>
        <Link className="btn btn-ghost" href="/ogrenci/karne">
          Karne
        </Link>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Yoklamalarım</h2>
          <ul className="text-sm space-y-1">
            {student.attendance.map((a) => (
              <li key={a.id}>
                {a.session.date} {a.session.schedule.course.name}: {a.status}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Zaman tüneli</h2>
          <ul className="text-sm space-y-1">
            {student.checkIns.map((e) => (
              <li key={e.id}>
                {formatTrDateTime(e.timestamp)} · {e.kind} · {e.location.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
