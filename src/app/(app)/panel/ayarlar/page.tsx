import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveTenantSettings } from "@/app/actions";
import { parseJsonArray } from "@/lib/types";

export default async function SettingsPage() {
  const actor = await requireActor();
  const tenant = actor.tenantId
    ? await prisma.tenant.findUnique({ where: { id: actor.tenantId } })
    : null;
  if (!tenant) return <p>Tenant bulunamadı.</p>;
  const channels = parseJsonArray(tenant.notificationChannels);
  return (
    <div>
      <PageHeader title="Firma ayarları" subtitle="Akademik takvim, yoklama politikası, KVKK maskeleme ve bildirim kanalları." />
      <form action={saveTenantSettings} className="card p-6 grid md:grid-cols-2 gap-4 max-w-4xl">
        <input type="hidden" name="id" value={tenant.id} />
        <Field label="Firma adı" name="name" defaultValue={tenant.name} required />
        <Field label="Vergi No / MERSİS" name="taxNo" defaultValue={tenant.taxNo ?? ""} />
        <Field label="Çalışma başlangıç" name="workStart" type="time" defaultValue={tenant.workStart} />
        <Field label="Çalışma bitiş" name="workEnd" type="time" defaultValue={tenant.workEnd} />
        <Field
          label="Yoklama düzeltme penceresi (saat)"
          name="attendanceCorrectionHours"
          type="number"
          defaultValue={String(tenant.attendanceCorrectionHours)}
        />
        <Field
          label="Geç kalma eşiği (dk)"
          name="lateThresholdMinutes"
          type="number"
          defaultValue={String(tenant.lateThresholdMinutes)}
        />
        <label className="text-sm font-medium">
          KVKK maskeleme
          <select className="select mt-1" name="kvkkMasking" defaultValue={tenant.kvkkMasking}>
            <option value="NONE">Yok</option>
            <option value="PHONE">Telefon maskeli</option>
            <option value="EMAIL">E-posta maskeli</option>
            <option value="BOTH">Her ikisi</option>
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium mb-1">Bildirim kanalları</legend>
          {["IN_APP", "PUSH", "SMS", "EMAIL"].map((c) => (
            <label key={c} className="mr-3">
              <input type="checkbox" name="channels" value={c} defaultChecked={channels.includes(c)} /> {c}
            </label>
          ))}
        </fieldset>
        <div className="md:col-span-2">
          <button className="btn btn-primary" type="submit">
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

function Field(props: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean }) {
  return (
    <label className="text-sm font-medium">
      {props.label}
      <input
        className="input mt-1"
        name={props.name}
        defaultValue={props.defaultValue}
        type={props.type}
        required={props.required}
      />
    </label>
  );
}
