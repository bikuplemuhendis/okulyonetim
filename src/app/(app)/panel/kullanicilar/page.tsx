import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveUser } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/types";
import { assignableRoles, tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { maskForActor, loadTenant } from "@/lib/services";
import { Flash, NeedTenant } from "@/components/flash";
import Link from "next/link";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const tenant = await loadTenant(actor);
  const branches = await scopedBranches(actor);
  const users = await prisma.user.findMany({
    where: {
      ...tenantFilter(actor),
      ...(!["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_OPS"].includes(actor.role) && actor.branchIds.length
        ? { scopes: { some: { branchId: { in: actor.branchIds } } } }
        : {}),
    },
    include: { scopes: { include: { branch: true } } },
    orderBy: { name: "asc" },
  });
  const roles = assignableRoles(actor.role);
  const editing = users.find((u) => u.id === sp.edit);
  const editingScope = new Set(editing?.scopes.map((s) => s.branchId) ?? []);
  return (
    <div>
      <PageHeader title="Kullanıcılar / personel" subtitle="Rol + şube kapsamı. Pasif kullanıcı giriş yapamaz." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveUser} className="card p-5 mb-6 grid md:grid-cols-2 gap-3">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <input className="input" name="name" placeholder="Ad soyad" required minLength={2} defaultValue={editing?.name ?? ""} />
        <input
          className="input"
          name="email"
          type="email"
          placeholder="E-posta"
          required
          defaultValue={editing?.email ?? ""}
        />
        <input className="input" name="phone" placeholder="Telefon" defaultValue={editing?.phone ?? ""} />
        <input
          className="input"
          name="password"
          type="password"
          placeholder={editing ? "Parola (boş bırakılırsa değişmez)" : "Parola (boşsa Demo123!)"}
        />
        <select className="select" name="role" defaultValue={editing?.role ?? "TEACHER"}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select className="select" name="status" defaultValue={editing?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <div className="md:col-span-2 text-sm">
          <div className="font-medium mb-1">Kapsam (şube)</div>
          {branches.map((b) => (
            <label key={b.id} className="mr-3">
              <input type="checkbox" name="branchIds" value={b.id} defaultChecked={editingScope.has(b.id)} /> {b.name}
            </label>
          ))}
        </div>
        <button className="btn btn-primary">{editing ? "Güncelle" : "Kaydet"}</button>
        {editing ? (
          <Link className="btn btn-ghost" href="/panel/kullanicilar">
            Vazgeç
          </Link>
        ) : null}
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>E-posta</th>
              <th>Telefon</th>
              <th>Rol</th>
              <th>Kapsam</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const masked = maskForActor(actor, tenant?.kvkkMasking ?? "PHONE", {
                phone: u.phone,
                email: u.email,
              });
              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{masked.email}</td>
                  <td>{masked.phone}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.scopes.map((s) => s.branch.name).join(", ") || "Firma"}</td>
                  <td>{u.status}</td>
                  <td>
                    <Link className="text-kampus-700 text-xs" href={`/panel/kullanicilar?edit=${u.id}`}>
                      Düzenle
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
