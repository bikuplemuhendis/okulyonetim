import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { SelfCheckInButton } from "@/components/checkin";
import { redirect } from "next/navigation";
import { student360 } from "@/lib/sis";
import Link from "next/link";
import { Pill } from "@/components/sis-ui";

export default async function StudentHome() {
  const actor = await requireActor();
  if (actor.role !== "STUDENT" || !actor.studentId) redirect("/panel");
  const snap = await student360(actor, actor.studentId);
  if (!snap) return <p>Kayıt yok.</p>;
  const s = snap.student;
  return (
    <div>
      <PageHeader title={`Merhaba ${s.name}`} subtitle={`${s.classroom.name} · not, ödev, etüt ve kampüs check-in.`} />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="card p-4"><div className="text-xs text-slate-500">Ortalama</div><div className="text-2xl font-semibold">{snap.avg ?? "—"}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Davranış</div><div className="text-2xl font-semibold">{snap.behavior}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Rozet</div><div className="text-2xl font-semibold">{s.achievements.length}</div></div>
      </div>
      <div className="card p-5 mb-6">
        <SelfCheckInButton />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <Link className="btn btn-ghost" href="/ogrenci/notlar">Notlarım</Link>
        <Link className="btn btn-ghost" href="/ogrenci/odevler">Ödevlerim</Link>
        <Link className="btn btn-ghost" href="/ogrenci/takvim">Ajanda</Link>
        <Link className="btn btn-ghost" href="/panel/etut">Etüt</Link>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Son notlar</h2>
          <ul className="text-sm space-y-1">
            {s.grades.slice(0, 6).map((g) => (
              <li key={g.id}>{g.assessment.course.name}: {g.score}/{g.assessment.maxScore}</li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Ödevler</h2>
          <ul className="text-sm space-y-1">
            {s.homeworkSubs.slice(0, 6).map((h) => (
              <li key={h.id}><Pill>{h.status}</Pill> {h.homework.title}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
