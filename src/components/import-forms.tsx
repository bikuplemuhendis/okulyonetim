"use client";

import { useActionState } from "react";
import { importScheduleAction, importStudentsAction } from "@/app/actions";

export function StudentImportForm({
  branches,
}: {
  branches: { id: string; name: string; code: string }[];
}) {
  const [state, action, pending] = useActionState(importStudentsAction, null);
  return (
    <form action={action} className="space-y-3">
      <select className="select" name="branchId" required>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.code})
          </option>
        ))}
      </select>
      <textarea
        className="textarea font-mono min-h-40"
        name="csv"
        required
        placeholder="ogrenci_no,ad_soyad,sinif,veli_ad,veli_telefon,veli_eposta,veli_iliski,kvkk_onay"
      />
      <button className="btn btn-primary" disabled={pending}>
        Öğrencileri aktar
      </button>
      {state && "error" in state && state.error ? <p className="text-red-700 text-sm">{state.error}</p> : null}
      {state && "ok" in state ? (
        <p className="text-sm">
          Aktarılan: {state.created}. Hata satırı: {state.issues.length}
          {state.issues.length ? (
            <ul className="mt-2 text-red-700">
              {state.issues.map((i) => (
                <li key={`${i.row}-${i.message}`}>
                  Satır {i.row}: {i.message}
                </li>
              ))}
            </ul>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}

export function ScheduleImportForm() {
  const [state, action, pending] = useActionState(importScheduleAction, null);
  return (
    <form action={action} className="space-y-3">
      <textarea
        className="textarea font-mono min-h-40"
        name="csv"
        required
        placeholder="sube_kodu,sinif,ders_kodu,ogretmen_eposta,lokasyon,gun,baslangic,bitis"
      />
      <button className="btn btn-primary" disabled={pending}>
        Programı aktar
      </button>
      {state && "error" in state && state.error ? <p className="text-red-700 text-sm">{state.error}</p> : null}
      {state && "ok" in state ? (
        <p className="text-sm">
          Aktarılan: {state.created}. Hata: {state.issues.length}
        </p>
      ) : null}
    </form>
  );
}
