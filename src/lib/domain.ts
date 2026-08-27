import type { AttendanceStatus, Role, SessionStatus } from "@prisma/client";
import { timeToMinutes } from "./time";

export type LiveColor = "green" | "yellow" | "red" | "gray" | "white";

export const GRADE_BANDS: { value: string; label: string }[] = [
  { value: "ANAOKULU", label: "Anaokulu" },
  { value: "ILKOKUL", label: "İlkokul" },
  { value: "ORTAOKUL", label: "Ortaokul" },
  { value: "LISE", label: "Lise" },
  { value: "DIGER", label: "Diğer" },
];

export const GRADE_LEVELS = ["Hazırlık", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export const CLASS_SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function composeClassroomName(gradeLevel: string, section?: string | null) {
  const g = gradeLevel.trim();
  const s = (section ?? "").trim();
  if (!g) return s;
  if (!s) return g;
  return `${g}-${s}`;
}

export function inferGradeBand(gradeLevel: string): string {
  const n = Number(gradeLevel);
  if (gradeLevel === "Hazırlık") return "LISE";
  if (!Number.isFinite(n)) return "DIGER";
  if (n <= 4) return "ILKOKUL";
  if (n <= 8) return "ORTAOKUL";
  if (n <= 12) return "LISE";
  return "DIGER";
}

export function classifyAttendance(opts: {
  checkInAtMinutes: number;
  sessionStart: string;
  lateThresholdMinutes: number;
}): AttendanceStatus {
  const start = timeToMinutes(opts.sessionStart);
  if (opts.checkInAtMinutes > start + opts.lateThresholdMinutes) return "LATE";
  return "PRESENT";
}

export function canCorrectAttendance(opts: {
  role: Role;
  finalizedAt: Date | null;
  windowHours: number;
  now: Date;
}): { ok: boolean; reason?: string } {
  if (opts.role !== "TENANT_OWNER" && opts.role !== "BRANCH_MANAGER") {
    return { ok: false, reason: "Yoklama düzeltme yalnızca firma sahibi veya şube müdürüne açıktır." };
  }
  if (!opts.finalizedAt) return { ok: true };
  const limitMs = opts.windowHours * 60 * 60 * 1000;
  if (opts.now.getTime() - opts.finalizedAt.getTime() > limitMs) {
    return { ok: false, reason: `Düzeltme penceresi (${opts.windowHours} saat) dolmuş.` };
  }
  return { ok: true };
}

export function liveColor(opts: {
  locationStatus: string;
  locationType: string;
  hasScheduledNow: boolean;
  sessionStatus: SessionStatus | null;
  unauthorizedRecent: boolean;
}): LiveColor {
  if (opts.locationStatus !== "ACTIVE") return "white";
  if (opts.unauthorizedRecent && !opts.hasScheduledNow) return "red";
  if (opts.locationType === "GATE" || opts.locationType === "LIBRARY") {
    return opts.unauthorizedRecent ? "red" : "gray";
  }
  if (!opts.hasScheduledNow) return "gray";
  if (opts.sessionStatus === "OPEN") return "green";
  if (opts.sessionStatus === "FINALIZED") return "gray";
  return "yellow";
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "***";
  const keep = u.slice(0, 1);
  return `${keep}***@${d}`;
}

export function applyKvkkMask(
  policy: "NONE" | "PHONE" | "EMAIL" | "BOTH",
  value: { phone?: string | null; email?: string | null },
) {
  const phone =
    policy === "PHONE" || policy === "BOTH" ? maskPhone(value.phone) : value.phone ?? "—";
  const email =
    policy === "EMAIL" || policy === "BOTH" ? maskEmail(value.email) : value.email ?? "—";
  return { phone, email };
}

export function interpolateTemplate(
  body: string,
  vars: Record<string, string | number | undefined | null>,
) {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(vars[key] ?? ""));
}

export function inQuietHours(nowHhmm: string, quietStart?: string | null, quietEnd?: string | null) {
  if (!quietStart || !quietEnd) return false;
  const now = timeToMinutes(nowHhmm);
  const s = timeToMinutes(quietStart);
  const e = timeToMinutes(quietEnd);
  if (s === e) return false;
  if (s < e) return now >= s && now < e;
  return now >= s || now < e;
}

export function canViewCounseling(opts: { role: Role; privacy: "LOW" | "MEDIUM" | "HIGH" }) {
  if (opts.role === "COUNSELOR" || opts.role === "PLATFORM_SUPER_ADMIN") return true;
  if (opts.privacy === "HIGH") return opts.role === "TENANT_OWNER";
  if (opts.privacy === "MEDIUM") {
    return ["TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER"].includes(opts.role);
  }
  return ["TENANT_OWNER", "TENANT_OPS", "BRANCH_MANAGER", "BRANCH_OPS", "TEACHER"].includes(
    opts.role,
  );
}

export function shouldRateLimit(opts: {
  lastSentAt: Date | null;
  now: Date;
  windowMinutes: number;
}) {
  if (!opts.lastSentAt) return false;
  return opts.now.getTime() - opts.lastSentAt.getTime() < opts.windowMinutes * 60 * 1000;
}

export type CsvIssue = { row: number; message: string };

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (cols[i] ?? "").trim();
    });
    return rec;
  });
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export const STUDENT_CSV_HEADERS = [
  "ogrenci_no",
  "ad_soyad",
  "sinif",
  "veli_ad",
  "veli_telefon",
  "veli_eposta",
  "veli_iliski",
  "kvkk_onay",
];

export const SCHEDULE_CSV_HEADERS = [
  "sube_kodu",
  "sinif",
  "ders_kodu",
  "ogretmen_eposta",
  "lokasyon",
  "gun",
  "baslangic",
  "bitis",
];

export function validateStudentCsvRow(row: Record<string, string>, index: number): CsvIssue[] {
  const issues: CsvIssue[] = [];
  if (!row.ogrenci_no) issues.push({ row: index, message: "ogrenci_no zorunlu" });
  if (!row.ad_soyad || row.ad_soyad.length < 2) issues.push({ row: index, message: "ad_soyad 2+ karakter" });
  if (!row.sinif) issues.push({ row: index, message: "sinif zorunlu" });
  if (!row.veli_telefon) issues.push({ row: index, message: "veli_telefon zorunlu" });
  if (row.kvkk_onay && !["1", "evet", "true", "onayli", "onaylı"].includes(row.kvkk_onay.toLowerCase())) {
    issues.push({ row: index, message: "kvkk_onay 1/evet/true olmalı" });
  }
  return issues;
}

export function validateScheduleCsvRow(row: Record<string, string>, index: number): CsvIssue[] {
  const issues: CsvIssue[] = [];
  for (const h of SCHEDULE_CSV_HEADERS) {
    if (!row[h]) issues.push({ row: index, message: `${h} zorunlu` });
  }
  const day = Number(row.gun);
  if (row.gun && (day < 1 || day > 7)) issues.push({ row: index, message: "gun 1-7 olmalı" });
  if (row.baslangic && row.bitis && timeToMinutes(row.baslangic) >= timeToMinutes(row.bitis)) {
    issues.push({ row: index, message: "baslangic < bitis olmalı" });
  }
  return issues;
}

export function sessionCountsAsRealized(status: SessionStatus) {
  return status === "OPEN" || status === "FINALIZED";
}
