import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveTemplate } from "@/app/actions";

export default async function TemplatesPage() {
  const actor = await requireActor();
  const templates = await prisma.notificationTemplate.findMany({
    where: { tenantId: actor.tenantId ?? undefined },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader
        title="Bildirim şablonları"
        subtitle="Değişkenler: {ogrenci_ad}, {tarih}, {saat}, {sube}. SMS gerçek gönderilmez; kayıt simüle edilir."
      />
      <form action={saveTemplate} className="card p-5 mb-6 grid md:grid-cols-2 gap-3">
        <input className="input" name="name" placeholder="Şablon adı" required />
        <select className="select" name="channel">
          <option>SMS</option>
          <option>PUSH</option>
          <option>EMAIL</option>
          <option>IN_APP</option>
        </select>
        <input className="input md:col-span-2" name="title" placeholder="Başlık (push/e-posta)" />
        <textarea className="textarea md:col-span-2" name="body" required placeholder="İçerik" />
        <button className="btn btn-primary">Ekle</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Kanal</th>
              <th>İçerik</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.channel}</td>
                <td className="max-w-md">{t.body}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
