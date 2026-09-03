import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";
import { sisLookups } from "@/lib/sis-lists";
import { requestMeetingAction } from "@/app/sis-actions";

export default async function ParentMeet({ searchParams }: { searchParams: Promise<{ child?: string; ok?: string; err?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const sp = await searchParams;
  const { student } = await parentChildren(actor, sp.child);
  if (!student) return <p>Öğrenci yok.</p>;
  const lookups = await sisLookups(actor);
  const mine = await prisma.parentMeeting.findMany({
    where: { studentId: student.id },
    include: { teacher: true },
    orderBy: { slot: "asc" },
  });
  return (
    <div>
      <PageHeader title="Öğretmen randevusu" subtitle={student.name} />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={requestMeetingAction} className="card p-5 grid md:grid-cols-2 gap-3 mb-6">
        <input type="hidden" name="branchId" value={student.branchId} />
        <input type="hidden" name="studentId" value={student.id} />
        <input type="hidden" name="parentName" value={actor.name} />
        <select className="select" name="teacherId" required>{lookups.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input className="input" name="slot" placeholder="2026-09-08 16:30" required />
        <select className="select" name="mode"><option value="YUZ_YUZE">Yüz yüze</option><option value="ONLINE">Online</option></select>
        <input className="input" name="note" placeholder="Konu" />
        <button className="btn btn-primary">Talep et</button>
      </form>
      <div className="space-y-3">
        {mine.map((m) => (
          <article key={m.id} className="card p-5">
            <div className="font-semibold">{m.teacher.name}</div>
            <p className="text-sm text-slate-500">{m.slot} · {m.mode} · {m.status}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
