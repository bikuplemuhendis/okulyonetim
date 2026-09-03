import { describe, expect, it } from "vitest";
import { hiddenHrefs, localePack, localizeNav } from "./locale";
import type { NavItem } from "./nav";

describe("lokalizasyon paketleri", () => {
  it("üç dikeyi ayırır", () => {
    expect(localePack("NIDO").learner).toBe("çocuk");
    expect(localePack("KURS").learner).toBe("kursiyer");
    expect(localePack("KAMPUS").learner).toBe("öğrenci");
  });
  it("nido not defterini gizler, günlükü bırakır", () => {
    expect(hiddenHrefs("NIDO")).toContain("/panel/notlar");
    expect(hiddenHrefs("NIDO")).not.toContain("/panel/gunluk");
  });
  it("kurs canlı bina ve servisi gizler", () => {
    expect(hiddenHrefs("KURS")).toContain("/panel/canli");
    expect(hiddenHrefs("KURS")).toContain("/veli/servis");
  });
  it("nav filtreler", () => {
    const items: NavItem[] = [
      { href: "/panel/notlar", label: "Not", group: "A" },
      { href: "/panel/gunluk", label: "Günlük", group: "A" },
    ];
    expect(localizeNav(items, "NIDO").map((i) => i.href)).toEqual(["/panel/gunluk"]);
  });
});
