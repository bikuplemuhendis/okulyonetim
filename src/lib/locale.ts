import type { Vertical } from "@prisma/client";
import type { NavItem } from "./nav";

export type LocalePack = {
  vertical: Vertical;
  productName: string;
  tagline: string;
  learner: string;
  learners: string;
  classroom: string;
  teacher: string;
  parent: string;
  dashboardTitle: string;
  dashboardSubtitle: string;
};

const PACKS: Record<Vertical, LocalePack> = {
  KAMPUS: {
    vertical: "KAMPUS",
    productName: "KampüsTakip",
    tagline: "K-12 kampüs ve SIS",
    learner: "öğrenci",
    learners: "öğrenciler",
    classroom: "sınıf",
    teacher: "öğretmen",
    parent: "veli",
    dashboardTitle: "Firma kokpiti",
    dashboardSubtitle: "Şube karşılaştırması, yoklama ısısı ve kampüs check-in aktivitesi.",
  },
  NIDO: {
    vertical: "NIDO",
    productName: "NidoTakip",
    tagline: "Anaokulu / kreş operasyonu",
    learner: "çocuk",
    learners: "çocuklar",
    classroom: "yaş grubu",
    teacher: "eğitmen",
    parent: "veli",
    dashboardTitle: "Yuvalar kokpiti",
    dashboardSubtitle: "Günlük rapor, yoklama ve veli akışını WhatsApp’sız tek panelde toplayın.",
  },
  KURS: {
    vertical: "KURS",
    productName: "KursTakip",
    tagline: "Dershane / kurs akademisi",
    learner: "kursiyer",
    learners: "kursiyerler",
    classroom: "grup",
    teacher: "öğretmen",
    parent: "veli / kayıt",
    dashboardTitle: "Akademi kokpiti",
    dashboardSubtitle: "Deneme, ödev, etüt ve kayıt hunisi — şube kampüs katmanı sadeleştirildi.",
  },
};

export function localePack(vertical: Vertical | null | undefined): LocalePack {
  return PACKS[vertical ?? "KAMPUS"];
}

export function hiddenHrefs(vertical: Vertical): string[] {
  switch (vertical) {
    case "KAMPUS":
      return [];
    case "NIDO":
      return [
        "/panel/notlar",
        "/panel/odevler",
        "/panel/konular",
        "/panel/etut",
        "/panel/kutuphane",
        "/veli/notlar",
        "/veli/odevler",
        "/ogrenci/notlar",
        "/ogrenci/odevler",
        "/ogrenci",
      ];
    case "KURS":
      return ["/panel/canli", "/panel/binalar", "/panel/yemekhane", "/panel/servis", "/veli/servis", "/panel/nobet"];
    default: {
      const _never: never = vertical;
      return _never;
    }
  }
}

export function localizeNav(items: NavItem[], vertical: Vertical): NavItem[] {
  const hidden = new Set(hiddenHrefs(vertical));
  const pack = localePack(vertical);
  return items
    .filter((i) => !hidden.has(i.href))
    .map((i) => {
      if (i.href === "/panel/ogrenciler") {
        return { ...i, label: pack.vertical === "NIDO" ? "Çocuklar" : pack.vertical === "KURS" ? "Kursiyerler" : i.label };
      }
      if (i.href === "/panel/siniflar") {
        return { ...i, label: pack.vertical === "NIDO" ? "Yaş grupları" : pack.vertical === "KURS" ? "Gruplar" : i.label };
      }
      return i;
    });
}

export const VERTICAL_LABELS: Record<Vertical, string> = {
  KAMPUS: "Kampüs (K-12)",
  NIDO: "Nido (anaokulu / kreş)",
  KURS: "Kurs (dershane)",
};
