import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { deleteCourseAction, saveCourse } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import Link from "next/link";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const courses = await prisma.course.findMany({ where: tenantFilter(actor), orderBy: { code: "asc" } });
  const editing = courses.find((c) => c.id === sp.edit);
  return (
    <div>
      <PageHeader title="Dersler" subtitle="Ad, branş, kod, süre ve yoklama tipi (ders/etüt)." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveCourse} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <input className="input" name="name" placeholder="Ders adı" required defaultValue={editing?.name ?? ""} />
        <input className="input" name="subject" placeholder="Branş" required defaultValue={editing?.subject ?? ""} />
        <input className="input" name="code" placeholder="MAT101" required defaultValue={editing?.code ?? ""} />
        <input
          className="input"
          name="durationMinutes"
          type="number"
          defaultValue={String(editing?.durationMinutes ?? 40)}
        />
        <select className="select" name="attendanceType" defaultValue={editing?.attendanceType ?? "LESSON"}>
          <option value="LESSON">Ders</option>
          <option value="STUDY">Etüt</option>
        </select>
        <button className="btn btn-primary">{editing ? "Güncelle" : "Ekle"}</button>
        {editing ? (
          <Link className="btn btn-ghost" href="/panel/dersler">
            Vazgeç
          </Link>
        ) : null}
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Ad</th>
              <th>Branş</th>
              <th>Süre</th>
              <th>Tip</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.subject}</td>
                <td>{c.durationMinutes} dk</td>
                <td>{c.attendanceType}</td>
                <td className="flex gap-3">
                  <Link className="text-kampus-700 text-xs" href={`/panel/dersler?edit=${c.id}`}>
                    Düzenle
                  </Link>
                  <ConfirmDelete action={deleteCourseAction} id={c.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
