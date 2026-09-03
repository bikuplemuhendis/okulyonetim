import type { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; group: string };

const org: NavItem[] = [
  { href: "/panel", label: "Kokpit", group: "Genel" },
  { href: "/panel/yapi", label: "Okul yapısı", group: "Organizasyon" },
  { href: "/panel/ayarlar", label: "Firma ayarları", group: "Organizasyon" },
  { href: "/panel/subeler", label: "Şubeler", group: "Organizasyon" },
  { href: "/panel/binalar", label: "Binalar", group: "Organizasyon" },
  { href: "/panel/lokasyonlar", label: "Lokasyonlar", group: "Organizasyon" },
  { href: "/panel/kullanicilar", label: "Kullanıcılar", group: "Organizasyon" },
];

const academic: NavItem[] = [
  { href: "/panel/siniflar", label: "Sınıflar", group: "Akademik" },
  { href: "/panel/dersler", label: "Dersler", group: "Akademik" },
  { href: "/panel/program", label: "Ders programı", group: "Akademik" },
  { href: "/panel/ogrenciler", label: "Öğrenciler", group: "Akademik" },
  { href: "/panel/import", label: "CSV içeri aktar", group: "Akademik" },
  { href: "/panel/notlar", label: "Not defteri", group: "Akademik" },
  { href: "/panel/odevler", label: "Ödevler", group: "Akademik" },
  { href: "/panel/konular", label: "Konu / müfredat", group: "Akademik" },
  { href: "/panel/etut", label: "Etüt", group: "Akademik" },
  { href: "/panel/kulupler", label: "Kulüpler", group: "Akademik" },
];

const life: NavItem[] = [
  { href: "/panel/takvim", label: "Ajanda", group: "Yaşam" },
  { href: "/panel/mesajlar", label: "Mesajlar", group: "Yaşam" },
  { href: "/panel/randevu", label: "Veli randevu", group: "Yaşam" },
  { href: "/panel/belgeler", label: "Belgeler", group: "Yaşam" },
  { href: "/panel/anketler", label: "Anketler", group: "Yaşam" },
];

const care: NavItem[] = [
  { href: "/panel/davranis", label: "Davranış", group: "Öğrenci hizmet" },
  { href: "/panel/saglik", label: "Sağlık / revir", group: "Öğrenci hizmet" },
  { href: "/panel/servis", label: "Servis", group: "Öğrenci hizmet" },
  { href: "/panel/kutuphane", label: "Kütüphane", group: "Öğrenci hizmet" },
  { href: "/panel/yemekhane", label: "Yemekhane", group: "Öğrenci hizmet" },
  { href: "/panel/basarilar", label: "Başarılar", group: "Öğrenci hizmet" },
];

const ops: NavItem[] = [
  { href: "/panel/canli", label: "Canlı bina", group: "Operasyon" },
  { href: "/panel/istisnalar", label: "İstisnalar", group: "Operasyon" },
  { href: "/panel/yoklama", label: "Sınıf defteri", group: "Operasyon" },
  { href: "/panel/mazeretler", label: "Mazeretler", group: "Operasyon" },
  { href: "/panel/ziyaretci", label: "Ziyaretçi", group: "Operasyon" },
  { href: "/panel/nobet", label: "Nöbet", group: "Operasyon" },
  { href: "/panel/personel-devam", label: "Personel devam", group: "Operasyon" },
];

const comms: NavItem[] = [
  { href: "/panel/duyurular", label: "Duyurular", group: "İletişim" },
  { href: "/panel/sablonlar", label: "Bildirim şablonları", group: "İletişim" },
  { href: "/panel/bildirimler", label: "Gönderimler", group: "İletişim" },
];

const institution: NavItem[] = [
  { href: "/panel/finans", label: "Ücret / kasa", group: "Kurum" },
  { href: "/panel/kayit", label: "Ön kayıt", group: "Kurum" },
  { href: "/panel/stok", label: "Stok / zimmet", group: "Kurum" },
];

const insight: NavItem[] = [
  { href: "/panel/raporlar", label: "Raporlar", group: "Karar destek" },
  { href: "/panel/denetim", label: "Denetim izi", group: "Karar destek" },
];

const guidance: NavItem[] = [{ href: "/panel/rehberlik", label: "Rehberlik 360°", group: "Rehberlik" }];
const superAdmin: NavItem[] = [{ href: "/panel/firmalar", label: "Firmalar", group: "Platform" }];

function fullSuite(extra: NavItem[] = []) {
  return [...extra, ...org, ...academic, ...nidoOps, ...life, ...care, ...ops, ...comms, ...institution, ...insight, ...guidance];
}

const nidoOps: NavItem[] = [
  { href: "/panel/gunluk", label: "Günlük rapor", group: "Bakım" },
  { href: "/panel/teslim", label: "Teslim kişileri", group: "Bakım" },
];

export function navFor(role: Role): NavItem[] {
  switch (role) {
    case "PLATFORM_SUPER_ADMIN":
      return fullSuite(superAdmin);
    case "TENANT_OWNER":
    case "TENANT_OPS":
      return fullSuite();
    case "BRANCH_MANAGER":
      return [
        { href: "/panel", label: "Kokpit", group: "Genel" },
        { href: "/panel/yapi", label: "Okul yapısı", group: "Organizasyon" },
        { href: "/panel/binalar", label: "Binalar", group: "Organizasyon" },
        { href: "/panel/lokasyonlar", label: "Lokasyonlar", group: "Organizasyon" },
        { href: "/panel/kullanicilar", label: "Personel", group: "Organizasyon" },
        ...academic,
        ...nidoOps,
        ...life,
        ...care,
        ...ops,
        ...comms,
        ...institution,
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
        { href: "/panel/ziyaretci", label: "Ziyaretçi", group: "Operasyon" },
        ...nidoOps,
        ...life,
        ...care,
        ...comms,
        ...institution,
        { href: "/panel/raporlar", label: "Raporlar", group: "Karar destek" },
      ];
    case "TEACHER":
      return [
        { href: "/panel", label: "Bugün", group: "Genel" },
        { href: "/panel/yoklama", label: "Sınıf defteri", group: "Operasyon" },
        { href: "/panel/gunluk", label: "Günlük rapor", group: "Bakım" },
        { href: "/panel/program", label: "Programım", group: "Akademik" },
        { href: "/panel/ogrenciler", label: "Öğrencilerim", group: "Akademik" },
        { href: "/panel/notlar", label: "Not defteri", group: "Akademik" },
        { href: "/panel/odevler", label: "Ödevler", group: "Akademik" },
        { href: "/panel/konular", label: "Konular", group: "Akademik" },
        { href: "/panel/etut", label: "Etüt", group: "Akademik" },
        { href: "/panel/davranis", label: "Davranış", group: "Öğrenci hizmet" },
        { href: "/panel/mesajlar", label: "Mesajlar", group: "Yaşam" },
        { href: "/panel/randevu", label: "Veli randevu", group: "Yaşam" },
        { href: "/panel/takvim", label: "Ajanda", group: "Yaşam" },
        { href: "/panel/duyurular", label: "Duyurular", group: "İletişim" },
        { href: "/panel/nobet", label: "Nöbetim", group: "Operasyon" },
      ];
    case "COUNSELOR":
      return [
        { href: "/panel", label: "Özet", group: "Genel" },
        ...guidance,
        { href: "/panel/ogrenciler", label: "Öğrenciler", group: "Akademik" },
        { href: "/panel/davranis", label: "Davranış", group: "Öğrenci hizmet" },
        { href: "/panel/saglik", label: "Sağlık", group: "Öğrenci hizmet" },
        { href: "/panel/istisnalar", label: "İstisnalar", group: "Operasyon" },
        { href: "/panel/mesajlar", label: "Mesajlar", group: "Yaşam" },
        { href: "/panel/anketler", label: "Anketler", group: "Yaşam" },
        ...comms,
      ];
    case "PARENT":
      return [
        { href: "/veli", label: "360° özet", group: "Veli" },
        { href: "/veli/gunluk", label: "Günlük rapor", group: "Veli" },
        { href: "/veli/devamsizlik", label: "Devamsızlık", group: "Veli" },
        { href: "/veli/notlar", label: "Notlar", group: "Veli" },
        { href: "/veli/odevler", label: "Ödevler", group: "Veli" },
        { href: "/veli/takvim", label: "Ajanda", group: "Veli" },
        { href: "/veli/mesajlar", label: "Mesajlar", group: "Veli" },
        { href: "/veli/odeme", label: "Ödemeler", group: "Veli" },
        { href: "/veli/servis", label: "Servis", group: "Veli" },
        { href: "/veli/randevu", label: "Öğretmen randevu", group: "Veli" },
        { href: "/veli/bildirimler", label: "Bildirim ayarları", group: "Veli" },
      ];
    case "STUDENT":
      return [
        { href: "/ogrenci", label: "Özetim", group: "Öğrenci" },
        { href: "/ogrenci/notlar", label: "Notlarım", group: "Öğrenci" },
        { href: "/ogrenci/odevler", label: "Ödevlerim", group: "Öğrenci" },
        { href: "/ogrenci/takvim", label: "Ajanda", group: "Öğrenci" },
        { href: "/panel/duyurular", label: "Duyurular", group: "Öğrenci" },
        { href: "/panel/etut", label: "Etüt", group: "Öğrenci" },
        { href: "/panel/kulupler", label: "Kulüpler", group: "Öğrenci" },
        { href: "/panel/kutuphane", label: "Kütüphane", group: "Öğrenci" },
        { href: "/panel/yemekhane", label: "Yemek", group: "Öğrenci" },
      ];
  }
}
