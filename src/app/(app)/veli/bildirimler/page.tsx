import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveParentPrefs } from "@/app/actions";
import { parseJsonArray } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function ParentPrefs() {
  const actor = await requireActor();
  if (actor.role !== "PARENT") redirect("/panel");
  const links = await prisma.parentStudent.findMany({
    where: { parentId: actor.id },
    include: { student: true },
  });
  const student = links[0]?.student;
  if (!student) return <p>Öğrenci yok.</p>;
  const pref = await prisma.notificationPreference.findUnique({
    where: { parentId_studentId: { parentId: actor.id, studentId: student.id } },
  });
  const channels = parseJsonArray(pref?.channels);
  return (
    <div>
      <PageHeader title="Bildirim ayarları" subtitle={`${student.name} için kanal, eşik ve sessiz saatler.`} />
      <form action={saveParentPrefs} className="card p-6 max-w-lg space-y-3">
        <input type="hidden" name="studentId" value={student.id} />
        <label className="block">
          <input type="checkbox" name="gateIn" defaultChecked={pref?.gateIn ?? true} /> Okula giriş bildirimi
        </label>
        <label className="block">
          <input type="checkbox" name="gateOut" defaultChecked={pref?.gateOut ?? true} /> Okuldan çıkış bildirimi
        </label>
        <label className="block">
          <input type="checkbox" name="late" defaultChecked={pref?.late ?? true} /> Derse geç kalma
        </label>
        <label className="block">
          Eşik (dk)
          <input className="input mt-1" type="number" name="lateThresholdMinutes" defaultValue={pref?.lateThresholdMinutes ?? 10} />
        </label>
        <label className="block">
          <input type="checkbox" name="absence" defaultChecked={pref?.absence ?? true} /> Devamsızlık
        </label>
        <div>
          Kanal
          {["IN_APP", "PUSH", "SMS", "EMAIL"].map((c) => (
            <label key={c} className="ml-3">
              <input type="checkbox" name="channels" value={c} defaultChecked={channels.includes(c) || c === "IN_APP"} /> {c}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Sessiz başlangıç
            <input className="input mt-1" type="time" name="quietStart" defaultValue={pref?.quietStart ?? "22:00"} />
          </label>
          <label>
            Sessiz bitiş
            <input className="input mt-1" type="time" name="quietEnd" defaultValue={pref?.quietEnd ?? "07:00"} />
          </label>
        </div>
        <button className="btn btn-primary">Kaydet</button>
      </form>
    </div>
  );
}
