"use client";

import { switchTenantAction } from "@/app/actions";

export function TenantSwitcher({
  tenants,
  currentId,
}: {
  tenants: { id: string; name: string; vertical?: string }[];
  currentId: string | null;
}) {
  return (
    <form action={switchTenantAction} className="flex items-center gap-2">
      <label className="text-xs text-slate-500 whitespace-nowrap">Firma</label>
      <select
        className="select py-1 text-sm max-w-[200px]"
        name="tenantId"
        defaultValue={currentId ?? ""}
        key={currentId ?? "all"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Tüm firmalar</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.vertical ? `${t.name} · ${t.vertical}` : t.name}
          </option>
        ))}
      </select>
    </form>
  );
}

export function ConfirmDelete({
  action,
  id,
  extra,
  label = "Sil",
  prompt = "Bu kaydı silmek istiyor musunuz?",
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  extra?: Record<string, string>;
  label?: string;
  prompt?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(prompt)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {extra
        ? Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <button className="text-red-700 text-xs" type="submit">
        {label}
      </button>
    </form>
  );
}
