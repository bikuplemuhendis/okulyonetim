import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { saveInventoryAction } from "@/app/sis-actions";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const items = await prisma.inventoryItem.findMany({ where: tenantFilter(actor), orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader title="Stok / zimmet / demirbaş" subtitle="Depo adedi, yer, zimmetli kişi. Kantin POS sonraki faz." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveInventoryAction} className="card p-5 grid md:grid-cols-5 gap-3 mb-6">
        <input className="input" name="name" placeholder="Kalem" required />
        <input className="input" name="category" placeholder="Kırtasiye" required />
        <input className="input" name="qty" type="number" defaultValue={1} />
        <input className="input" name="location" placeholder="Depo A" required />
        <input className="input" name="assignedTo" placeholder="Zimmet (opsiyonel)" />
        <button className="btn btn-primary md:col-span-5">Ekle</button>
      </form>
      <table className="table card">
        <thead><tr><th>Ürün</th><th>Kategori</th><th>Adet</th><th>Yer</th><th>Zimmet</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}><td>{i.name}</td><td>{i.category}</td><td>{i.qty}</td><td>{i.location}</td><td>{i.assignedTo ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
