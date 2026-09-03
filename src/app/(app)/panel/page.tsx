import { requireActor } from "@/lib/auth";
import { dashboardMetrics } from "@/lib/services";
import { PageHeader } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const actor = await requireActor();
  if (actor.role === "PARENT") {
    /* layout still used for /panel; parents normally land on /veli */
  }
  const m = await dashboardMetrics(actor);
  const announcements = actor.tenantId
    ? await prisma.announcement.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { createdAt: "desc" },
        take: 4,
      })
    : [];
  const hours = [...new Set(m.heatmap.map((h) => h.hour))].sort((a, b) => a - b);
  const days = [...new Set(m.heatmap.map((h) => h.day))];
  const max = Math.max(1, ...m.heatmap.map((h) => h.absences + h.lates));

  return (
    <div>
      <PageHeader
        title="Firma kokpiti"
        subtitle="Şube karşılaştırması, katılım ısı haritası ve check-in noktası aktivitesi (RFID cihaz sağlığı yerine)."
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Aktif öğrenci" value={String(m.studentCount)} />
        <Stat
          label="Ders saati doluluk (7g)"
          value={`%${m.occupancy}`}
          hint={`${m.realizedMinutes} dk gerçekleşen / plan × 5 gün`}
        />
        <Stat label="Bugün devamsız" value={String(m.todayAbsences)} />
        <Stat label="Açık istisna" value={String(m.openIncidents)} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-1">Katılım ısı haritası</h2>
          <p className="text-xs text-slate-500 mb-3">Gün × saat; koyuluk = devamsızlık + geç kalma</p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="p-1" />
                  {hours.map((h) => (
                    <th key={h} className="p-1 font-medium text-slate-500">
                      {h}:00
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d}>
                    <td className="p-1 pr-2 whitespace-nowrap text-slate-600">{d.slice(5)}</td>
                    {hours.map((h) => {
                      const cell = m.heatmap.find((x) => x.day === d && x.hour === h);
                      const v = (cell?.absences ?? 0) + (cell?.lates ?? 0);
                      const a = v / max;
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            title={`${v}`}
                            className="h-7 w-7 rounded"
                            style={{ background: `rgba(15,76,92,${0.12 + a * 0.85})` }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Check-in noktası aktivitesi</h2>
          <p className="text-sm text-slate-600 mb-3">
            RFID heartbeat yerine son 30 dk web olayı olan lokasyonlar.
          </p>
          <div className="text-3xl font-semibold">
            {m.locationHealth.active}/{m.locationHealth.total}
          </div>
          <p className="text-sm text-slate-500 mt-1">{m.locationHealth.idle} nokta boş/idle</p>
          <Link href="/panel/canli" className="btn btn-primary mt-4 inline-flex">
            Canlı bina
          </Link>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Şubeler</h2>
          <ul className="space-y-2 text-sm">
            {m.branches.map((b) => (
              <li key={b.id} className="flex justify-between border-b border-slate-100 pb-2">
                <span>
                  {b.name} <span className="text-slate-400">{b.code}</span>
                </span>
                <span className="badge bg-kampus-100 text-kampus-700">{b.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">SIS süiti</h2>
          <p className="text-sm text-slate-600 mb-3">K12NET 44 modülünün modern karşılığı — akademik, yaşam, finans, operasyon.</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["/panel/notlar", "Not defteri"],
              ["/panel/odevler", "Ödevler"],
              ["/panel/finans", "Ücret"],
              ["/panel/kayit", "Ön kayıt"],
              ["/panel/mesajlar", "Mesaj"],
              ["/panel/servis", "Servis"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl border border-slate-100 px-3 py-2 hover:bg-kampus-100">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Duyurular</h2>
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id}>
                <div className="font-medium">{a.title}</div>
                <p className="text-sm text-slate-600">{a.body}</p>
              </li>
            ))}
            {!announcements.length ? <p className="text-sm text-slate-500">Duyuru yok.</p> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint ? <div className="text-xs text-slate-500 mt-1">{hint}</div> : null}
    </div>
  );
}
