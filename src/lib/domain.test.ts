import { describe, expect, it } from "vitest";
import {
  applyKvkkMask,
  canCorrectAttendance,
  canViewCounseling,
  classifyAttendance,
  inQuietHours,
  interpolateTemplate,
  liveColor,
  parseCsv,
  shouldRateLimit,
  validateScheduleCsvRow,
  validateStudentCsvRow,
} from "./domain";

describe("yoklama sınıflandırma", () => {
  it("eşik içinde mevcut sayar", () => {
    expect(
      classifyAttendance({ checkInAtMinutes: 9 * 60 + 5, sessionStart: "09:00", lateThresholdMinutes: 10 }),
    ).toBe("PRESENT");
  });
  it("eşik sonrası geç sayar", () => {
    expect(
      classifyAttendance({ checkInAtMinutes: 9 * 60 + 15, sessionStart: "09:00", lateThresholdMinutes: 10 }),
    ).toBe("LATE");
  });
});

describe("düzeltme yetkisi", () => {
  const finalizedAt = new Date("2026-08-27T08:00:00Z");
  it("öğretmene kapalıdır", () => {
    const r = canCorrectAttendance({
      role: "TEACHER",
      finalizedAt,
      windowHours: 48,
      now: new Date("2026-08-27T10:00:00Z"),
    });
    expect(r.ok).toBe(false);
  });
  it("pencere içinde müdüre açıktır", () => {
    const r = canCorrectAttendance({
      role: "BRANCH_MANAGER",
      finalizedAt,
      windowHours: 48,
      now: new Date("2026-08-28T07:00:00Z"),
    });
    expect(r.ok).toBe(true);
  });
  it("pencere dolunca kapanır", () => {
    const r = canCorrectAttendance({
      role: "TENANT_OWNER",
      finalizedAt,
      windowHours: 48,
      now: new Date("2026-08-30T08:00:00Z"),
    });
    expect(r.ok).toBe(false);
  });
});

describe("canlı renkler", () => {
  it("pasif lokasyon beyazdır", () => {
    expect(
      liveColor({
        locationStatus: "PASSIVE",
        locationType: "CLASSROOM",
        hasScheduledNow: true,
        sessionStatus: "OPEN",
        unauthorizedRecent: false,
      }),
    ).toBe("white");
  });
  it("oturum açıkken yeşildir", () => {
    expect(
      liveColor({
        locationStatus: "ACTIVE",
        locationType: "CLASSROOM",
        hasScheduledNow: true,
        sessionStatus: "OPEN",
        unauthorizedRecent: false,
      }),
    ).toBe("green");
  });
  it("öğretmen check-in yoksa sarıdır", () => {
    expect(
      liveColor({
        locationStatus: "ACTIVE",
        locationType: "CLASSROOM",
        hasScheduledNow: true,
        sessionStatus: "PENDING",
        unauthorizedRecent: false,
      }),
    ).toBe("yellow");
  });
  it("plansız hareket kırmızıdır", () => {
    expect(
      liveColor({
        locationStatus: "ACTIVE",
        locationType: "CLASSROOM",
        hasScheduledNow: false,
        sessionStatus: null,
        unauthorizedRecent: true,
      }),
    ).toBe("red");
  });
});

describe("kvkk ve şablon", () => {
  it("telefonu maskeler", () => {
    expect(applyKvkkMask("PHONE", { phone: "+905551112233" }).phone).toContain("****");
  });
  it("değişken doldurur", () => {
    expect(interpolateTemplate("{ogrenci_ad} {tarih}", { ogrenci_ad: "Mehmet", tarih: "27.08.2026" })).toBe(
      "Mehmet 27.08.2026",
    );
  });
  it("gece sessiz saatini tanır", () => {
    expect(inQuietHours("23:00", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("08:00", "22:00", "07:00")).toBe(false);
  });
});

describe("rehberlik gizlilik", () => {
  it("yüksek gizliliği operasyona kapatır", () => {
    expect(canViewCounseling({ role: "BRANCH_OPS", privacy: "HIGH" })).toBe(false);
    expect(canViewCounseling({ role: "COUNSELOR", privacy: "HIGH" })).toBe(true);
  });
});

describe("csv", () => {
  it("öğrenci satırını doğrular", () => {
    const issues = validateStudentCsvRow({ ogrenci_no: "", ad_soyad: "A", sinif: "", veli_telefon: "" }, 2);
    expect(issues.length).toBeGreaterThan(0);
  });
  it("program saatini doğrular", () => {
    const issues = validateScheduleCsvRow(
      {
        sube_kodu: "ANK-01",
        sinif: "12-A",
        ders_kodu: "MAT101",
        ogretmen_eposta: "t@x.com",
        lokasyon: "12-A Kapısı",
        gun: "1",
        baslangic: "10:00",
        bitis: "09:00",
      },
      2,
    );
    expect(issues.some((i) => i.message.includes("baslangic"))).toBe(true);
  });
  it("csv parse eder", () => {
    const { rows } = parseCsv("a,b\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2" });
  });
});

describe("rate limit", () => {
  it("pencere içinde tekrar gönderimi engeller", () => {
    expect(
      shouldRateLimit({
        lastSentAt: new Date("2026-08-27T10:00:00Z"),
        now: new Date("2026-08-27T10:05:00Z"),
        windowMinutes: 15,
      }),
    ).toBe(true);
  });
});
