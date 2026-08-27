"use client";

import { useState } from "react";
import { checkInAction } from "@/app/actions";

export function KioskForm({ locationId, locationName }: { locationId: string; locationName: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      action={async (fd) => {
        setError(null);
        try {
          const res = await checkInAction(fd);
          setMessage(res.message);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Hata");
        }
      }}
    >
      <input type="hidden" name="locationId" value={locationId} />
      <p className="text-sm text-slate-600">
        RFID yerine web kiosk: öğrenci numarasını girin. Kayıt <strong>{locationName}</strong> noktasına işlenir.
      </p>
      <input className="input text-lg" name="studentNo" placeholder="Öğrenci no (ör. 202612001)" required />
      <button className="btn btn-primary w-full py-3 text-base" type="submit">
        Check-in
      </button>
      {message ? <p className="text-emerald-700 text-sm font-medium">{message}</p> : null}
      {error ? <p className="text-red-700 text-sm">{error}</p> : null}
    </form>
  );
}

export function SelfCheckInButton() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      action={async () => {
        const { studentSelfCheckIn } = await import("@/app/actions");
        try {
          setMsg(await studentSelfCheckIn());
        } catch (e) {
          setMsg(e instanceof Error ? e.message : "Hata");
        }
      }}
    >
      <button className="btn btn-primary" type="submit">
        Derse katıl (web yoklama)
      </button>
      {msg ? <p className="text-sm mt-2">{msg}</p> : null}
    </form>
  );
}
