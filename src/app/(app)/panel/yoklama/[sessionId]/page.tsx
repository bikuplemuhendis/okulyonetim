import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { finalizeSessionAction, markAttendanceAction } from "@/app/actions";
import { assertBranch, assertTenant } from "@/lib/rbac";
import { notFound } from "next/navigation";
const colors: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  LATE: "bg-amber-100 text-amber-800",
  ABSENT: "bg-red-100 text-red-800",
  EXCUSED: "bg-sky-100 text-sky-800",
  PENDING: "bg-slate-100 text-slate-700",
};

export default async function ClassbookPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await requireActor();
  const { sessionId } = await params;
  const session = await prisma.lessonSession.findUnique({
    where: { id: sessionId },
    include: {
      teacher: true,
      schedule: { include: { course: true, classroom: { include: { students: { where: { status: "ACTIVE" } } } } } },
      attendance: true,
    },
  });
  if (!session) notFound();
  try {
    assertTenant(actor, session.tenantId);
    assertBranch(actor, session.schedule.branchId);
  } catch {
    notFound();
  }
  return (
    <div>
      <PageHeader
        title={`${session.schedule.course.name} · ${session.schedule.classroom.name}`}
        subtitle={`${session.teacher.name} · ${session.date} · ${session.schedule.startTime}–${session.schedule.endTime} · ${session.status}`}
        actions={
          session.status !== "FINALIZED" ? (
            <form action={finalizeSessionAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button className="btn btn-accent">Dersi bitir (finalize)</button>
            </form>
          ) : (
            <span className="text-sm text-slate-500">Kilitli — düzeltme yetkiye ve pencereye bağlı</span>
          )
        }
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {session.schedule.classroom.students.map((st) => {
          const row = session.attendance.find((a) => a.studentId === st.id);
          const status = row?.status ?? "PENDING";
          return (
            <div key={st.id} className="card p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium">{st.name}</div>
                  <div className="text-xs text-slate-500">{st.studentNo}</div>
                </div>
                <span className={`badge ${colors[status]}`}>{status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kaynak: {row?.source ?? "—"} {row?.reason ? `· ${row.reason}` : ""}
              </p>
              <form action={markAttendanceAction} className="mt-3 grid grid-cols-2 gap-2">
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="studentId" value={st.id} />
                <select className="select" name="status" defaultValue={status === "PENDING" ? "PRESENT" : status}>
                  <option value="PRESENT">Mevcut</option>
                  <option value="LATE">Geç</option>
                  <option value="EXCUSED">İzinli</option>
                  <option value="ABSENT">Gelmedi</option>
                </select>
                <select className="select" name="reason" defaultValue="Manuel web yoklama">
                  <option>Manuel web yoklama</option>
                  <option>Kartını unuttu</option>
                  <option>Sağlık</option>
                  <option>Geç servis</option>
                </select>
                <input className="input col-span-2" name="note" placeholder="Not (ops.)" />
                <button className="btn btn-primary col-span-2">İşaretle</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
