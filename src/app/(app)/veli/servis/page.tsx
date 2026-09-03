import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { redirect } from "next/navigation";
import { parentChildren } from "@/lib/parent-child";
import { student360 } from "@/lib/sis";

export default async function ParentBus({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const { student } = await parentChildren(actor, (await searchParams).child);
  if (!student) return <p>Öğrenci yok.</p>;
  const snap = await student360(actor, student.id);
  return (
    <div>
      <PageHeader title="Servis" subtitle={student.name} />
      {snap?.student.busAssignments.map((b) => (
        <article key={b.id} className="card p-5">
          <h2 className="font-semibold">{b.route.name}</h2>
          <p className="text-sm">{b.route.vehicle} · {b.route.plate} · {b.route.driver}</p>
          <p className="text-sm mt-1">Durak: {b.stopName} · sabah {b.route.morningEta}</p>
        </article>
      ))}
      {!snap?.student.busAssignments.length ? <p className="text-sm text-slate-500">Servis ataması yok.</p> : null}
    </div>
  );
}
