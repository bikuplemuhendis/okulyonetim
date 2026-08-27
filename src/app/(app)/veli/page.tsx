import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

export default async function ParentHome({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await prisma.parentStudent.findMany({
    where: { parentId: actor.id },
    include: { student: { include: { classroom: true } } },
  });
  const sp = await searchParams;
  const student = links.find((l) => l.studentId === sp.child)?.student ?? links[0]?.student;
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const events = await prisma.checkInEvent.findMany({
    where: { studentId: student.id },
    include: { location: true },
    orderBy: { timestamp: "desc" },
    take: 40,
  });
  const announcements = await prisma.announcement.findMany({
    where: { tenantId: actor.tenantId ?? undefined },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return (
    <div>
      <PageHeader title="Zaman tüneli" subtitle="Okula giriş, ders yoklaması, kütüphane ve çıkış olayları — RFID yerine web check-in." />
      <form className="mb-4">
        <select className="select max-w-xs" name="child" defaultValue={student.id}>
          {links.map((l) => (
            <option key={l.studentId} value={l.studentId}>
              {l.student.name}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost ml-2">Seç</button>
      </form>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {events.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="text-xs text-slate-500">{formatTrDateTime(e.timestamp)}</div>
              <div className="font-medium">
                {labelKind(e.kind)} · {e.location.name}
              </div>
              <div className="text-sm text-slate-600">
                {e.result} {e.reason ? `· ${e.reason}` : ""}
              </div>
            </div>
          ))}
          {!events.length ? <p className="text-sm text-slate-500">Henüz olay yok.</p> : null}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Duyurular</h2>
          {announcements.map((a) => (
            <div key={a.id} className="mb-3">
              <div className="font-medium text-sm">{a.title}</div>
              <p className="text-xs text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function labelKind(k: string) {
  if (k === "GATE_IN") return "Okula giriş";
  if (k === "GATE_OUT") return "Okuldan çıkış";
  if (k === "CLASS") return "Derse giriş";
  if (k === "LIBRARY") return "Kütüphane";
  return k;
}
