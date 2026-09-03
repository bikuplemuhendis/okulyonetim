import { describe, expect, it } from "vitest";
import { behaviorBalance, feeStatus, homeworkStatus, remainingFee, weightedAverage } from "./sis";

describe("not ortalaması", () => {
  it("ağırlıklı yüzde üretir", () => {
    expect(
      weightedAverage([
        { score: 80, maxScore: 100, weight: 2 },
        { score: 40, maxScore: 50, weight: 1 },
      ]),
    ).toBe(80);
  });
  it("boş listede null döner", () => {
    expect(weightedAverage([])).toBeNull();
  });
});

describe("ücret durumu", () => {
  it("tam ödeme PAID", () => {
    expect(feeStatus(12000, 12000, "2026-09-01", "2026-09-03")).toBe("PAID");
  });
  it("vadesi geçmiş kısmi OVERDUE", () => {
    expect(feeStatus(12000, 3000, "2026-09-01", "2026-09-03")).toBe("OVERDUE");
  });
  it("kalan tutarı hesaplar", () => {
    expect(remainingFee(1000.5, 250.25)).toBe(750.25);
  });
});

describe("ödev durumu", () => {
  it("teslim edilmiş SUBMITTED", () => {
    expect(homeworkStatus("2026-09-01", new Date(), "2026-09-03")).toBe("SUBMITTED");
  });
  it("geç teslim edilmemiş LATE", () => {
    expect(homeworkStatus("2026-09-01", null, "2026-09-03")).toBe("LATE");
  });
});

describe("davranış bakiyesi", () => {
  it("artı eksi toplar", () => {
    expect(behaviorBalance([5, -2, 1])).toBe(4);
  });
});
