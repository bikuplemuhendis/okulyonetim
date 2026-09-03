"use server";

import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { addPickupContact, upsertDailyReport } from "@/lib/care";

function fd(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function bounce(path: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : "İşlem başarısız";
  redirect(`${path}?err=${encodeURIComponent(msg)}`);
}

export async function saveDailyReportAction(form: FormData) {
  const actor = await requireActor();
  try {
    await upsertDailyReport(actor, {
      studentId: fd(form, "studentId"),
      date: fd(form, "date"),
      mood: fd(form, "mood"),
      meals: fd(form, "meals"),
      sleepMinutes: Number(fd(form, "sleepMinutes") || 0),
      toilet: fd(form, "toilet"),
      activities: fd(form, "activities"),
      photoNote: fd(form, "photoNote") || undefined,
      note: fd(form, "note"),
    });
  } catch (e) {
    bounce("/panel/gunluk", e);
  }
  redirect("/panel/gunluk?ok=1");
}

export async function savePickupAction(form: FormData) {
  const actor = await requireActor();
  try {
    await addPickupContact(actor, {
      studentId: fd(form, "studentId"),
      name: fd(form, "name"),
      phone: fd(form, "phone"),
      relation: fd(form, "relation"),
    });
  } catch (e) {
    bounce("/panel/teslim", e);
  }
  redirect("/panel/teslim?ok=1");
}
