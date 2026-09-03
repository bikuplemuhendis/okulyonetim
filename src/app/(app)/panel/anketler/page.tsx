import { requireActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/flash";
import { tenantFilter } from "@/lib/rbac";
import { answerSurveyAction, saveSurveyAction } from "@/app/sis-actions";

export default async function SurveysPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const items = await prisma.survey.findMany({
    where: tenantFilter(actor),
    include: { responses: true },
    orderBy: { createdAt: "desc" },
  });
  const write = !["PARENT", "STUDENT"].includes(actor.role);
  return (
    <div>
      <PageHeader title="Anketler" subtitle="Canlı ortalama ve açık uçlu notlar." />
      <Flash ok={sp.ok} err={sp.err} />
      {write ? (
        <form action={saveSurveyAction} className="card p-5 grid gap-3 mb-6">
          <input className="input" name="title" placeholder="Anket adı" required />
          <textarea className="textarea" name="question" placeholder="Soru" required />
          <input className="input" name="audience" defaultValue="PARENT" />
          <label className="text-sm"><input type="checkbox" name="required" /> Zorunlu</label>
          <button className="btn btn-primary">Yayınla</button>
        </form>
      ) : null}
      <div className="space-y-4">
        {items.map((s) => {
          const avg = s.responses.length ? (s.responses.reduce((a, r) => a + r.score, 0) / s.responses.length).toFixed(1) : "—";
          return (
            <article key={s.id} className="card p-5">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm">{s.question}</p>
              <p className="text-xs text-slate-500 mt-1">Ort. {avg} · {s.responses.length} yanıt</p>
              <form action={answerSurveyAction} className="grid md:grid-cols-3 gap-2 mt-3">
                <input type="hidden" name="surveyId" value={s.id} />
                <input className="input" name="score" type="number" min={1} max={5} defaultValue={4} />
                <input className="input" name="comment" placeholder="Yorum" />
                <button className="btn btn-ghost">Yanıtla</button>
              </form>
              <ul className="text-sm mt-3 space-y-1">
                {s.responses.map((r) => <li key={r.id}>{r.authorName}: {r.score}/5 {r.comment ? `— ${r.comment}` : ""}</li>)}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
