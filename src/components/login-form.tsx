"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

const demos = [
  ["Süper admin", "super@kampus.local"],
  ["Firma sahibi", "sahip@xkolej.local"],
  ["Şube müdürü", "mudur@cankaya.local"],
  ["Öğretmen", "ogretmen@cankaya.local"],
  ["Rehberlik", "rehberlik@cankaya.local"],
  ["Veli", "veli@cankaya.local"],
  ["Öğrenci", "ogrenci@cankaya.local"],
];

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        E-posta
        <input className="input mt-1" name="email" type="email" required defaultValue="sahip@xkolej.local" />
      </label>
      <label className="block text-sm font-medium">
        Parola
        <input className="input mt-1" name="password" type="password" required defaultValue="Demo123!" />
      </label>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending} type="submit">
        {pending ? "Giriş..." : "Giriş yap"}
      </button>
      <p className="text-xs text-slate-500">Demo parola tüm hesaplarda: Demo123!</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {demos.map(([label, email]) => (
          <div key={email} className="rounded-lg bg-slate-50 px-2 py-1.5 border border-slate-100">
            <div className="font-medium">{label}</div>
            <div className="text-slate-500 truncate">{email}</div>
          </div>
        ))}
      </div>
    </form>
  );
}
