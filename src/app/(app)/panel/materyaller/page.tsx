import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteMaterialAction, saveMaterialAction } from "@/app/sis-actions";
import { canEnterGrades, tenantFilter } from "@/lib/rbac";
import { MATERIAL_VISIBILITY_LABELS } from "@/lib/sis";
import { teacherClassroomIds } from "@/lib/sis-service";
import { scopedBranches } from "@/lib/services";
import { FileLink } from "@/components/sis-ui";
import { formatTrDateTime } from "@/lib/time";
import Link from "next/link";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string }>;
}) {
  const actor = await requireActor();
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const classIds = actor.role === "TEACHER" ? await teacherClassroomIds(actor) : [];
  const rows = await prisma.material.findMany({
    where: {
      ...tenantFilter(actor),
      ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}),
    },
    include: { teacher: true, classroom: true, course: true, branch: true },
    orderBy: { createdAt: "desc" },
  });
  const editing = rows.find((r) => r.id === sp.edit);
  const branches = await scopedBranches(actor);
  const courses = await prisma.course.findMany({ where: tenantFilter(actor) });
  const classrooms = await prisma.classroom.findMany({
    where: { ...tenantFilter(actor), ...(classIds.length ? { id: { in: classIds } } : {}) },
  });
  const can = canEnterGrades(actor.role) || actor.role === "BRANCH_OPS";
  return (
    <div>
      <PageHeader title="Eğitim materyalleri" subtitle="Dosya yükleyin; sınıf, ders veya şube ile paylaşın." />
      <Flash ok={sp.ok} err={sp.err} />
      {can ? (
        <form action={saveMaterialAction} className="card p-5 mb-6 grid md:grid-cols-3 gap-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input className="input md:col-span-2" name="title" required placeholder="Başlık" defaultValue={editing?.title ?? ""} />
          <select className="select" name="visibility" defaultValue={editing?.visibility ?? "CLASS"}>
            {Object.entries(MATERIAL_VISIBILITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <textarea className="textarea md:col-span-3" name="description" defaultValue={editing?.description ?? ""} />
          <select className="select" name="branchId" defaultValue={editing?.branchId ?? branches[0]?.id ?? ""}>
            <option value="">Şube yok</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select" name="courseId" defaultValue={editing?.courseId ?? ""}>
            <option value="">Ders yok</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" name="classroomId" defaultValue={editing?.classroomId ?? ""}>
            <option value="">Sınıf yok</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {editing ? null : <input className="input md:col-span-3" type="file" name="file" required />}
          <button className="btn btn-primary">{editing ? "Güncelle" : "Yükle"}</button>
          {editing ? (
            <Link className="btn btn-ghost" href="/panel/materyaller">
              Vazgeç
            </Link>
          ) : null}
        </form>
      ) : null}
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="card p-5 flex justify-between gap-3">
            <div>
              <h2 className="font-semibold">{r.title}</h2>
              <p className="text-sm text-slate-600">{r.description}</p>
              <p className="text-xs text-slate-500 mt-1">
                {MATERIAL_VISIBILITY_LABELS[r.visibility]} · {r.classroom?.name ?? r.course?.name ?? r.branch?.name ?? "—"} ·{" "}
                {r.teacher.name} · {formatTrDateTime(r.createdAt)}
              </p>
              <FileLink id={r.id} label={r.fileName} />
            </div>
            {can && (actor.role !== "TEACHER" || r.teacherId === actor.id) ? (
              <div className="flex gap-3">
                <Link className="text-kampus-700 text-xs" href={`/panel/materyaller?edit=${r.id}`}>
                  Düzenle
                </Link>
                <ConfirmDelete action={deleteMaterialAction} id={r.id} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
