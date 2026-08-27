import { requireActor } from "@/lib/auth";
import { PageHeader } from "@/components/shell";
import { scopedBranches } from "@/lib/services";
import { ScheduleImportForm, StudentImportForm } from "@/components/import-forms";

export default async function ImportPage() {
  const actor = await requireActor();
  const branches = await scopedBranches(actor);
  return (
    <div>
      <PageHeader
        title="Toplu içeri aktarım"
        subtitle="Excel/CSV şablonu. Hatalı satırlar raporlanır. RFID kart UID alanı yoktur."
      />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Öğrenci şablonu</h2>
          <p className="text-xs text-slate-500 mb-3">
            ogrenci_no, ad_soyad, sinif, veli_ad, veli_telefon, veli_eposta, veli_iliski, kvkk_onay
          </p>
          <a className="text-sm text-kampus-700" href="/templates/ogrenci-import.csv">
            Şablonu indir
          </a>
          <div className="mt-3">
            <StudentImportForm branches={branches} />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Ders programı şablonu</h2>
          <p className="text-xs text-slate-500 mb-3">
            sube_kodu, sinif, ders_kodu, ogretmen_eposta, lokasyon, gun (1-7), baslangic, bitis
          </p>
          <a className="text-sm text-kampus-700" href="/templates/program-import.csv">
            Şablonu indir
          </a>
          <div className="mt-3">
            <ScheduleImportForm />
          </div>
        </div>
      </div>
    </div>
  );
}
