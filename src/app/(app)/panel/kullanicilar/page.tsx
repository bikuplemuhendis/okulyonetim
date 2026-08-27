import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveUser } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/types";
import { tenantFilter } from "@/lib/rbac";
import { scopedBranches } from "@/lib/services";
import { maskForActor, loadTenant } from "@/lib/services";
import type { Role } from "@prisma/client";

export default async function UsersPage() {
  const actor = await requireActor();
  const tenant = await loadTenant(actor);
  const branches = await scopedBranches(actor);
  const users = await prisma.user.findMany({
    where: tenantFilter(actor),
    include: { scopes: { include: { branch: true } } },
    orderBy: { name: "asc" },
  });
  const roles = Object.keys(ROLE_LABELS) as Role[];
  return (
    <div>
      <PageHeader title="Kullanıcılar / personel" subtitle="Rol + şube kapsamı. Pasif kullanıcı giriş yapamaz." />
      <form action={saveUser} className="card p-5 mb-6 grid md:grid-cols-2 gap-3">
        <input className="input" name="name" placeholder="Ad soyad" required minLength={2} />
        <input className="input" name="email" type="email" placeholder="E-posta" required />
        <input className="input" name="phone" placeholder="Telefon" />
        <input className="input" name="password" type="password" placeholder="Parola (boşsa Demo123!)" />
        <select className="select" name="role" defaultValue="TEACHER">
          {roles
            .filter((r) => r !== "PLATFORM_SUPER_ADMIN" || actor.role === "PLATFORM_SUPER_ADMIN")
            .map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
        </select>
        <select className="select" name="status" defaultValue="ACTIVE">
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <div className="md:col-span-2 text-sm">
          <div className="font-medium mb-1">Kapsam (şube)</div>
          {branches.map((b) => (
            <label key={b.id} className="mr-3">
              <input type="checkbox" name="branchIds" value={b.id} /> {b.name}
            </label>
          ))}
        </div>
        <button className="btn btn-primary">Kaydet</button>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
