import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { formatTrDateTime } from "@/lib/time";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";
import { student360 } from "@/lib/sis";
import { Pill } from "@/components/sis-ui";
import Link from "next/link";

export default async function ParentHome({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const sp = await searchParams;
  const { links, student } = await parentChildren(actor, sp.child);
  if (!student) return <p>Bağlı öğrenci yok.</p>;
  const snap = await student360(actor, student.id);
  const events = await prisma.checkInEvent.findMany({
    where: { studentId: student.id },
    include: { location: true },
    orderBy: { timestamp: "desc" },
    take: 12,
  });
  const meals = await prisma.mealMenu.findMany({
    where: { tenantId: actor.tenantId ?? undefined, branchId: student.branchId },
    orderBy: { date: "desc" },
    take: 3,
  });
  return (
    <div>
      <PageHeader
        title={`${student.name} · 360°`}
        subtitle={`${student.classroom.name} · not, ödev, servis, ücret ve kampüs zaman tüneli tek bakışta.`}
      />
      <form className="mb-5">
        <select className="select max-w-xs" name="child" defaultValue={student.id}>
          {links.map((l) => (
            <option key={l.studentId} value={l.studentId}>{l.student.name}</option>
          ))}
        </select>
        <button className="btn btn-ghost ml-2">Seç</button>
      </form>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <div className="card p-4"><div className="text-xs text-slate-500">Not ort.</div><div className="text-2xl font-semibold">{snap?.avg ?? "—"}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Davranış</div><div className="text-2xl font-semibold">{snap?.behavior ?? 0}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Açık ödev</div><div className="text-2xl font-semibold">{snap?.student.homeworkSubs.filter((h) => h.status === "ASSIGNED").length ?? 0}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Açık borç</div><div className="text-2xl font-semibold">{snap?.student.fees.filter((f) => f.status !== "PAID").length ?? 0}</div></div>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          ["/veli/gunluk", "Günlük"],
          ["/veli/notlar", "Notlar"],
          ["/veli/odevler", "Ödevler"],
          ["/veli/odeme", "Ödeme"],
          ["/veli/randevu", "Randevu"],
          ["/veli/servis", "Servis"],
        ].map(([href, label]) => (
          <Link key={href} href={`${href}?child=${student.id}`} className="btn btn-ghost">{label}</Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold">Kampüs zaman tüneli</h2>
          {events.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="text-xs text-slate-500">{formatTrDateTime(e.timestamp)}</div>
              <div className="font-medium">{labelKind(e.kind)} · {e.location.name}</div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold mb-2">Servis</h2>
            {snap?.student.busAssignments.map((b) => (
              <p key={b.id} className="text-sm">{b.route.name} · {b.stopName} · {b.route.morningEta}</p>
            ))}
            {!snap?.student.busAssignments.length ? <p className="text-sm text-slate-500">Atama yok</p> : null}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold mb-2">Menü</h2>
            {meals.map((m) => (
              <p key={m.id} className="text-sm mb-1"><Pill>{m.date}</Pill> {m.items}</p>
            ))}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold mb-2">Başarılar</h2>
            {snap?.student.achievements.map((a) => (
              <p key={a.id} className="text-sm">{a.badge} · {a.title}</p>
            ))}
          </div>
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
