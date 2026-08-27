import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { NeedTenant } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import Link from "next/link";

export default async function StructurePage() {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const tenant = actor.tenantId ? await prisma.tenant.findUnique({ where: { id: actor.tenantId } }) : null;
  const branches = await prisma.branch.findMany({
    where: tenantFilter(actor),
    include: {
      buildings: { orderBy: { name: "asc" } },
      locations: { orderBy: { name: "asc" } },
      classrooms: { include: { _count: { select: { students: true } } }, orderBy: { name: "asc" } },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });
  const courses = await prisma.course.count({ where: tenantFilter(actor) });
  const schedules = await prisma.lessonSchedule.count({ where: tenantFilter(actor) });
  return (
    <div>
      <PageHeader
        title="Okul yapısı"
        subtitle="Platform → firma → şube → bina/lokasyon → kademe/sınıf. RFID cihaz katmanı yok."
      />
      {tenant ? (
        <div className="card p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Firma</div>
            <div className="font-semibold">{tenant.name}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Akademik yıl</div>
            <div className="font-semibold">
              {tenant.academicYearStart.toISOString().slice(0, 10)} → {tenant.academicYearEnd.toISOString().slice(0, 10)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Ders / program</div>
            <div className="font-semibold">
              {courses} ders · {schedules} slot
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Durum</div>
            <div className="font-semibold">{tenant.status}</div>
          </div>
        </div>
      ) : null}
      <div className="space-y-4">
        {branches.map((b) => (
          <section key={b.id} className="card p-5">
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <h2 className="font-semibold">
                <Link className="text-kampus-700" href={`/panel/subeler/${b.id}`}>
                  {b.name}
                </Link>{" "}
                <span className="text-slate-400 font-normal">{b.code}</span>
              </h2>
              <span className="text-sm text-slate-500">
                {b._count.students} öğrenci · {b.status}
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium mb-1">Binalar</div>
                <ul className="space-y-1">
                  {b.buildings.map((x) => (
                    <li key={x.id}>{x.name}</li>
                  ))}
                  {!b.buildings.length ? <li className="text-slate-400">Tanımsız</li> : null}
                </ul>
                <Link className="text-xs text-kampus-700" href="/panel/binalar">
                  Yönet
                </Link>
              </div>
              <div>
                <div className="font-medium mb-1">Lokasyonlar</div>
                <ul className="space-y-1">
                  {b.locations.map((x) => (
                    <li key={x.id}>
                      {x.name} · {x.type}
                      {x.building ? ` · ${x.building}` : ""}
                    </li>
                  ))}
                </ul>
                <Link className="text-xs text-kampus-700" href="/panel/lokasyonlar">
                  Yönet
                </Link>
              </div>
              <div>
                <div className="font-medium mb-1">Sınıflar (kademe / şube)</div>
                <ul className="space-y-1">
                  {b.classrooms.map((x) => (
                    <li key={x.id}>
                      {x.name} · {x.band ?? "—"} / {x.gradeLevel}
                      {x.section ? `-${x.section}` : ""} · {x._count.students} öğr.
                    </li>
                  ))}
                </ul>
                <Link className="text-xs text-kampus-700" href="/panel/siniflar">
                  Yönet
                </Link>
              </div>
            </div>
          </section>
        ))}
        {!branches.length ? <p className="text-sm text-slate-500">Henüz şube yok.</p> : null}
      </div>
    </div>
  );
}
