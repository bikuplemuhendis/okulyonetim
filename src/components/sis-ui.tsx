import Link from "next/link";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 py-4">{children}</p>;
}

export function ModuleCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card p-4 hover:border-kampus-500/40 transition-colors block">
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-slate-600 mt-1">{desc}</p>
    </Link>
  );
}

export function Pill({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "orange" | "rose" | "slate" }) {
  const map = {
    teal: "bg-kampus-100 text-kampus-700",
    orange: "bg-orange-100 text-orange-800",
    rose: "bg-rose-100 text-rose-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`badge ${map[tone]}`}>{children}</span>;
}
