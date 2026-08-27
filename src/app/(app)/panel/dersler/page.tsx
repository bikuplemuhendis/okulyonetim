import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { saveCourse } from "@/app/actions";
import { tenantFilter } from "@/lib/rbac";

export default async function CoursesPage() {
  const actor = await requireActor();
  const courses = await prisma.course.findMany({ where: tenantFilter(actor), orderBy: { code: "asc" } });
  return (
    <div>
      <PageHeader title="Dersler" subtitle="Ad, branş, kod, süre ve yoklama tipi (ders/etüt)." />
      <form action={saveCourse} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
        <input className="input" name="name" placeholder="Ders adı" required />
        <input className="input" name="subject" placeholder="Branş" required />
        <input className="input" name="code" placeholder="MAT101" required />
        <input className="input" name="durationMinutes" type="number" defaultValue="40" />
        <select className="select" name="attendanceType" defaultValue="LESSON">
          <option value="LESSON">Ders</option>
          <option value="STUDY">Etüt</option>
        </select>
        <button className="btn btn-primary">Ekle</button>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
