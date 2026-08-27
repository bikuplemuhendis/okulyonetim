import Link from "next/link";
import { DAY_LABELS } from "@/lib/time";

export function ChildSwitcher({
  items,
  currentId,
}: {
  items: { id: string; name: string }[];
  currentId: string;
}) {
  return (
    <form className="mb-4">
      <select className="select max-w-xs" name="child" defaultValue={currentId}>
        {items.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button className="btn btn-ghost ml-2" type="submit">
        Seç
      </button>
    </form>
  );
}

export function WeeklyGrid({
  rows,
}: {
  rows: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    course: string;
    classroom: string;
    teacher: string;
    location: string;
  }[];
}) {
  const days = [1, 2, 3, 4, 5];
  const times = [...new Set(rows.map((r) => r.startTime))].sort();
  if (!rows.length) return <p className="text-sm text-slate-500">Program satırı yok.</p>;
  return (
    <div className="card overflow-x-auto mb-6">
      <table className="table min-w-[720px]">
        <thead>
          <tr>
            <th>Saat</th>
            {days.map((d) => (
              <th key={d}>{DAY_LABELS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={t}>
              <td className="whitespace-nowrap text-slate-500">{t}</td>
              {days.map((d) => {
                const cell = rows.find((r) => r.dayOfWeek === d && r.startTime === t);
                return (
                  <td key={d}>
                    {cell ? (
                      <div className="rounded-lg bg-kampus-100 p-2 text-xs">
                        <div className="font-semibold">{cell.course}</div>
                        <div>
                          {cell.classroom} · {cell.teacher}
                        </div>
                        <div className="text-slate-500">
                          {cell.startTime}–{cell.endTime} · {cell.location}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FileLink({ id, label }: { id: string; label: string }) {
  return (
    <Link className="text-kampus-700 text-sm" href={`/api/files/${id}`}>
      {label}
    </Link>
  );
}
