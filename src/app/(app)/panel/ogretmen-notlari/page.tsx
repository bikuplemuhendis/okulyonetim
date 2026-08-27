import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash, NeedTenant } from "@/components/flash";
import { ConfirmDelete } from "@/components/org-ui";
import { deleteTeacherNoteAction, saveTeacherNoteAction } from "@/app/sis-actions";
import { listTeacherNotes, teacherClassroomIds } from "@/lib/sis-service";
import { formatTrDateTime } from "@/lib/time";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TeacherNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; edit?: string; studentId?: string }>;
}) {
  const actor = await requireActor();
  if (!["TEACHER", "TENANT_OWNER", "BRANCH_MANAGER", "PLATFORM_SUPER_ADMIN"].includes(actor.role)) {
    redirect("/panel");
  }
  if (!actor.tenantId && actor.role === "PLATFORM_SUPER_ADMIN") return <NeedTenant />;
  const sp = await searchParams;
  const notes = await listTeacherNotes(actor, sp.studentId);
  const editing = notes.find((n) => n.id === sp.edit);
  const classIds = actor.role === "TEACHER" ? await teacherClassroomIds(actor) : [];
  const students = await prisma.student.findMany({
    where: {
      tenantId: actor.tenantId ?? undefined,
      status: "ACTIVE",
      ...(classIds.length ? { classroomId: { in: classIds } } : {}),
      ...(actor.role === "BRANCH_MANAGER" ? { branchId: { in: actor.branchIds } } : {}),
    },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader
        title="Öğretmen özel notları"
        subtitle="Yalnızca notu yazan öğretmen (ve sahip/müdür) görür. Diğer öğretmenler göremez."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveTeacherNoteAction} className="card p-5 mb-6 grid gap-3">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <select className="select" name="studentId" defaultValue={editing?.studentId ?? sp.studentId ?? ""}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <textarea className="textarea" name="body" required defaultValue={editing?.body ?? ""} placeholder="Özel not" />
        <button className="btn btn-primary">{editing ? "Güncelle" : "Kaydet"}</button>
      </form>
      <div className="space-y-3">
        {notes.map((n) => (
          <article key={n.id} className="card p-5">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-medium">{n.student.name}</div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {n.teacher.name} · {formatTrDateTime(n.createdAt)}
                </p>
              </div>
              <div className="flex gap-3">
                <Link className="text-kampus-700 text-xs" href={`/panel/ogretmen-notlari?edit=${n.id}`}>
                  Düzenle
                </Link>
                <ConfirmDelete action={deleteTeacherNoteAction} id={n.id} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
