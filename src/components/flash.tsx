export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) {
    return <p className="mb-4 rounded-xl bg-red-50 text-red-800 text-sm px-4 py-3">{err}</p>;
  }
  if (ok) {
    return <p className="mb-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm px-4 py-3">Kaydedildi.</p>;
  }
  return null;
}

export function NeedTenant() {
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Firma seçin</h1>
      <p className="text-sm text-slate-600 mt-2">
        Platform yöneticisi olarak okul yapısını yönetmek için üst menüden bir firma seçin. Yeni firma
        açmak için Firmalar sayfasını kullanın.
      </p>
    </div>
  );
}

export function dateInputValue(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}
