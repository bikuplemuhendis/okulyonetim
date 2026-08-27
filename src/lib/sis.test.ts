import { describe, expect, it } from "vitest";
import {
  assertPaymentAmount,
  canViewTeacherNote,
  clampScore,
  fivePointFromPercent,
  invoiceBalance,
  invoiceStatusFromBalance,
  letterFromPercent,
  parentOwnsStudent,
  weightedAverage,
} from "./sis";

describe("not ölçeği", () => {
  it("aralık dışı puanı reddeder", () => {
    expect(() => clampScore(101, 100)).toThrow(/arasında/);
    expect(() => clampScore(-1, 100)).toThrow(/arasında/);
    expect(clampScore(87.5, 100)).toBe(87.5);
  });
  it("ağırlıklı ortalamayı 100'lüğe çevirir", () => {
    expect(
      weightedAverage([
        { score: 40, maxScore: 50, weight: 2 },
        { score: 70, maxScore: 100, weight: 1 },
      ]),
    ).toBe(76.67);
  });
  it("harf ve 5'lik dilimleri üretir", () => {
    expect(letterFromPercent(91)).toBe("AA");
    expect(letterFromPercent(72)).toBe("CC");
    expect(letterFromPercent(49)).toBe("FF");
    expect(fivePointFromPercent(85)).toBe(5);
    expect(fivePointFromPercent(49)).toBe(1);
  });
});

describe("ücret bakiyesi", () => {
  it("kısmi tahsilatı PARTIAL yapar", () => {
    expect(invoiceBalance(1000, [{ amount: 400 }])).toBe(600);
    expect(invoiceStatusFromBalance(1000, [{ amount: 400 }], false)).toBe("PARTIAL");
    expect(invoiceStatusFromBalance(1000, [{ amount: 1000 }], false)).toBe("PAID");
    expect(invoiceStatusFromBalance(1000, [], true)).toBe("CANCELLED");
  });
  it("fazla ödemeyi reddeder", () => {
    expect(() => assertPaymentAmount(200, 150)).toThrow(/bakiyeyi/);
    expect(() => assertPaymentAmount(150, 150)).not.toThrow();
  });
});

describe("erişim", () => {
  it("öğretmen başka öğretmenin özel notunu göremez", () => {
    expect(canViewTeacherNote({ actorId: "t1", actorRole: "TEACHER", noteTeacherId: "t2" })).toBe(false);
    expect(canViewTeacherNote({ actorId: "t1", actorRole: "TEACHER", noteTeacherId: "t1" })).toBe(true);
    expect(canViewTeacherNote({ actorId: "m1", actorRole: "BRANCH_MANAGER", noteTeacherId: "t1" })).toBe(true);
  });
  it("veli yalnızca kendi çocuğunu görür", () => {
    const links = [{ parentId: "p1", studentId: "s1" }];
    expect(parentOwnsStudent("p1", links, "s1")).toBe(true);
    expect(parentOwnsStudent("p1", links, "s2")).toBe(false);
    expect(parentOwnsStudent("p2", links, "s1")).toBe(false);
  });
});
