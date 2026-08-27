import { requireActor } from "@/lib/auth";
import { liveBuilding } from "@/lib/services";
import { PageHeader } from "@/components/shell";
import { formatTrDateTime } from "@/lib/time";
import Link from "next/link";

const legend: { c: string; t: string }[] = [
  { c: "live-green", t: "Yeşil — ders işleniyor (öğretmen oturumu açık)" },
  { c: "live-yellow", t: "Sarı — ders saati, öğretmen check-in yok" },
  { c: "live-red", t: "Kırmızı — yetkisiz / plan dışı web check-in" },
  { c: "live-gray", t: "Gri — boş" },
  { c: "live-white", t: "Beyaz — pasif / kurulum" },
];

export default async function LivePage({ searchParams }: { searchParams: Promise<{ branchId?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const { branch, cards, branches } = await liveBuilding(actor, sp.branchId);
  const grouped = new Map<string, typeof cards>();
  for (const card of cards) {
    const key = `${card.location.building ?? "Bina"} / ${card.location.floor ?? "Kat"}`;
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }
  return (
    <div>
      <PageHeader
        title="Canlı bina izleme"
        subtitle="RFID cihaz durumu yerine web check-in ve öğretmen oturumu. Kartlar bina → kat gruplanır."
      />
      <form className="mb-4">
        <select className="select max-w-xs" name="branchId" defaultValue={branch?.id}>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost ml-2">Filtrele</button>
      </form>
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        {legend.map((l) => (
          <span key={l.t} className={`badge border ${l.c}`}>
            {l.t}
          </span>
        ))}
      </div>
      {[...grouped.entries()].map(([group, items]) => (
        <section key={group} className="mb-6">
          <h2 className="font-semibold mb-3">{group}</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((card) => (
              <div key={card.location.id} className={`card p-4 border-2 live-${card.color}`}>
                <div className="flex justify-between gap-2">
                  <div className="font-semibold">{card.location.name}</div>
                  <span className="text-xs">{card.location.type}</span>
                </div>
                <p className="text-sm mt-2">{card.courseName ?? "Boş"}</p>
                <p className="text-sm text-slate-600">{card.teacherName ?? (card.courseName ? "Öğretmen bekleniyor" : "—")}</p>
                <p className="text-sm mt-2">
                  Katılım: {card.present}/{card.total}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Son check-in: {card.lastCheckIn ? formatTrDateTime(card.lastCheckIn) : "yok"}
                </p>
                <Link className="text-xs text-kampus-700 mt-2 inline-block" href={`/kiosk/${card.location.id}`}>
                  Kiosk aç
                </Link>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
