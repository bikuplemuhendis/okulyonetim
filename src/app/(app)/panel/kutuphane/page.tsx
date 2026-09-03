import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { loanBookAction, returnBookAction, saveBookAction } from "@/app/sis-actions";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const titles = await prisma.libraryTitle.findMany({
    where: tenantFilter(actor),
    include: { loans: { include: { student: true } } },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Kütüphane" subtitle="Yayın, ödünç, iade. Öğrenci kendi açık ödünçlerini görür." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <form action={saveBookAction} className="card p-5 grid gap-3">
            <input className="input" name="title" placeholder="Kitap adı" required />
            <input className="input" name="author" placeholder="Yazar" required />
            <input className="input" name="copies" type="number" defaultValue={1} />
            <button className="btn btn-primary">Yayın ekle</button>
          </form>
          <form action={loanBookAction} className="card p-5 grid gap-3">
            <select className="select" name="titleId" required>{titles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
            <select className="select" name="studentId" required>{lookups.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <input className="input" name="dueDate" type="date" required />
            <button className="btn btn-primary">Ödünç ver</button>
          </form>
        </div>
      ) : null}
      <div className="space-y-3">
        {titles.map((t) => (
          <article key={t.id} className="card p-5">
            <h2 className="font-semibold">{t.title}</h2>
            <p className="text-sm text-slate-500">{t.author} · {t.copies} kopya</p>
            <ul className="text-sm mt-2 space-y-2">
              {t.loans.filter((l) => actor.role !== "STUDENT" || l.studentId === actor.studentId).map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span>{l.student.name} · {l.status} · son {l.dueDate}</span>
                  {write && l.status === "OUT" ? (
                    <form action={returnBookAction}><input type="hidden" name="loanId" value={l.id} /><button className="btn btn-ghost">İade</button></form>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
