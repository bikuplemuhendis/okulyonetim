import type { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; group: string };

export function navFor(role: Role): NavItem[] {
  const org: NavItem[] = [
    { href: "/panel", label: "Kokpit", group: "Genel" },
    { href: "/panel/ayarlar", label: "Firma ayarları", group: "Organizasyon" },
    { href: "/panel/subeler", label: "Şubeler", group: "Organizasyon" },
    { href: "/panel/lokasyonlar", label: "Lokasyonlar", group: "Organizasyon" },
    { href: "/panel/kullanicilar", label: "Kullanıcılar", group: "Organizasyon" },
  ];
  const academic: NavItem[] = [
    { href: "/panel/siniflar", label: "Sınıflar", group: "Akademik" },
    { href: "/panel/dersler", label: "Dersler", group: "Akademik" },
    { href: "/panel/program", label: "Ders programı", group: "Akademik" },
    { href: "/panel/ogrenciler", label: "Öğrenciler", group: "Akademik" },
    { href: "/panel/import", label: "CSV içeri aktar", group: "Akademik" },
  ];
  const ops: NavItem[] = [
    { href: "/panel/canli", label: "Canlı bina", group: "Operasyon" },
    { href: "/panel/istisnalar", label: "İstisnalar", group: "Operasyon" },
    { href: "/panel/yoklama", label: "Sınıf defteri", group: "Operasyon" },
    { href: "/panel/mazeretler", label: "Mazeretler", group: "Operasyon" },
  ];
  const comms: NavItem[] = [
    { href: "/panel/duyurular", label: "Duyurular", group: "İletişim" },
    { href: "/panel/sablonlar", label: "Bildirim şablonları", group: "İletişim" },
    { href: "/panel/bildirimler", label: "Gönderimler", group: "İletişim" },
  ];
  const insight: NavItem[] = [
    { href: "/panel/raporlar", label: "Raporlar", group: "Karar destek" },
    { href: "/panel/denetim", label: "Denetim izi", group: "Karar destek" },
  ];
  const guidance: NavItem[] = [{ href: "/panel/rehberlik", label: "Rehberlik 360°", group: "Rehberlik" }];
  const superAdmin: NavItem[] = [{ href: "/panel/firmalar", label: "Firmalar", group: "Platform" }];

  switch (role) {
    case "PLATFORM_SUPER_ADMIN":
      return [...superAdmin, ...org, ...academic, ...ops, ...comms, ...insight, ...guidance];
    case "TENANT_OWNER":
    case "TENANT_OPS":
      return [...org, ...academic, ...ops, ...comms, ...insight, ...guidance];
    case "BRANCH_MANAGER":
      return [
        { href: "/panel", label: "Kokpit", group: "Genel" },
        { href: "/panel/lokasyonlar", label: "Lokasyonlar", group: "Organizasyon" },
        { href: "/panel/kullanicilar", label: "Personel", group: "Organizasyon" },
        ...academic.filter((i) => i.href !== "/panel/import"),
        { href: "/panel/import", label: "CSV içeri aktar", group: "Akademik" },
        ...ops,
        ...comms,
        ...insight,
        ...guidance,
      ];
    case "BRANCH_OPS":
      return [
        { href: "/panel", label: "Kokpit", group: "Genel" },
        { href: "/panel/ogrenciler", label: "Öğrenciler", group: "Akademik" },
        { href: "/panel/canli", label: "Canlı bina", group: "Operasyon" },
        { href: "/panel/istisnalar", label: "İstisnalar", group: "Operasyon" },
        { href: "/panel/mazeretler", label: "Mazeretler", group: "Operasyon" },
        ...comms,
        { href: "/panel/raporlar", label: "Raporlar", group: "Karar destek" },
      ];
    case "TEACHER":
      return [
        { href: "/panel", label: "Bugün", group: "Genel" },
        { href: "/panel/yoklama", label: "Sınıf defteri", group: "Operasyon" },
        { href: "/panel/program", label: "Programım", group: "Akademik" },
        { href: "/panel/ogrenciler", label: "Öğrencilerim", group: "Akademik" },
        { href: "/panel/duyurular", label: "Duyurular", group: "İletişim" },
      ];
    case "COUNSELOR":
      return [
        { href: "/panel", label: "Özet", group: "Genel" },
        ...guidance,
        { href: "/panel/ogrenciler", label: "Öğrenciler", group: "Akademik" },
        { href: "/panel/istisnalar", label: "İstisnalar", group: "Operasyon" },
        ...comms,
      ];
    case "PARENT":
      return [
        { href: "/veli", label: "Zaman tüneli", group: "Veli" },
        { href: "/veli/devamsizlik", label: "Devamsızlık", group: "Veli" },
        { href: "/veli/bildirimler", label: "Bildirim ayarları", group: "Veli" },
      ];
    case "STUDENT":
      return [
        { href: "/ogrenci", label: "Özetim", group: "Öğrenci" },
        { href: "/panel/duyurular", label: "Duyurular", group: "Öğrenci" },
      ];
  }
}
