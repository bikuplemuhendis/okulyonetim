import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { sisLookups } from "@/lib/sis-lists";
import { saveAssessmentAction, saveGradeAction } from "@/app/sis-actions";
import { weightedAverage } from "@/lib/sis";

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const lookups = await sisLookups(actor);
  const assessments = await prisma.assessment.findMany({
    where: tenantFilter(actor),
    include: { course: true, grades: { include: { student: true } }, branch: true },
    orderBy: { examDate: "desc" },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Not defteri" subtitle="Sınav / performans kayıtları, karne ağırlığı ve öğrenci puanı — K12NET gradebook karşılığı, sade yüzey." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <form action={saveAssessmentAction} className="card p-5 grid gap-3">
            <h2 className="font-semibold">Yeni ölçme</h2>
            <select className="select" name="branchId" required>
              {lookups.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select className="select" name="courseId" required>
              {lookups.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input className="input" name="title" placeholder="1. yazılı" required />
            <select className="select" name="kind">
              <option value="EXAM">Yazılı</option>
              <option value="QUIZ">Quiz</option>
              <option value="PROJECT">Proje</option>
              <option value="ORAL">Sözlü</option>
              <option value="PERFORMANCE">Performans</option>
            </select>
            <input className="input" name="examDate" type="date" required />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" name="maxScore" type="number" defaultValue={100} />
              <input className="input" name="weight" type="number" step="0.1" defaultValue={1} />
            </div>
            <label className="text-sm"><input type="checkbox" name="countsForReport" defaultChecked /> Karneye girer</label>
            <button className="btn btn-primary">Ölçme oluştur</button>
          </form>
          <form action={saveGradeAction} className="card p-5 grid gap-3">
            <h2 className="font-semibold">Puan gir</h2>
            <select className="select" name="assessmentId" required>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>{a.course.name} · {a.title}</option>
              ))}
            </select>
            <select className="select" name="studentId" required>
              {lookups.students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.classroom.name}</option>
              ))}
            </select>
            <input className="input" name="score" type="number" step="0.1" required placeholder="Puan" />
            <input className="input" name="comment" placeholder="Kazanım notu (opsiyonel)" />
            <button className="btn btn-primary">Kaydet</button>
          </form>
        </div>
      ) : null}
      <div className="space-y-4">
        {assessments.map((a) => {
          const avg = weightedAverage(a.grades.map((g) => ({ score: g.score, maxScore: a.maxScore, weight: 1 })));
          return (
            <article key={a.id} className="card p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{a.title}</h2>
                  <p className="text-sm text-slate-500">{a.course.name} · {a.kind} · {a.examDate} · {a.branch.name}</p>
                </div>
                <span className="badge bg-kampus-100 text-kampus-700">Sınıf ort. {avg ?? "—"}</span>
              </div>
              <table className="table mt-3">
                <thead><tr><th>Öğrenci</th><th>Puan</th><th>Yorum</th></tr></thead>
                <tbody>
                  {a.grades.map((g) => (
                    <tr key={g.id}><td>{g.student.name}</td><td>{g.score}/{a.maxScore}</td><td>{g.comment ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </article>
          );
        })}
      </div>
    </div>
  );
}
