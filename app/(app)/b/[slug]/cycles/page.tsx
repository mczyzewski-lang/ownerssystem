import Link from "next/link";
import { getLineAccess, listUsers } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getConstraintMap, getCycles, type Cycle } from "@/lib/line-data";
import { getHypotheses } from "@/lib/growth-data";
import { saveCycle, setCycleStatus } from "@/lib/actions/growth";
import { Comments } from "@/components/comments";
import { Submit } from "@/components/client";
import { Card, Empty, Fact, Field, Pill, UserSelect } from "@/components/ui";
import { ACTIVE_HYPOTHESIS_STATUSES, fmtDate, MAX_ACTIVE, titleCase } from "@/lib/utils";

export const metadata = { title: "Growth Cycles" };

export default async function CyclesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { line, role, user } = await getLineAccess(slug);
  const [cycles, map, users, hypotheses, experiments] = await Promise.all([
    getCycles(line.id), getConstraintMap(line.id), listUsers(), getHypotheses(line.id),
    sql`select e.id, e.name, e.status, e.metric, e.deadline, e.hypothesis_id, e.cycle_id, u.name as owner from experiments e
        left join users u on u.id = e.owner_id where e.business_line_id = ${line.id} order by e.created_at`,
  ]);
  const ga = role === "growth_architect";
  const main = map.find((c) => c.status === "main");
  const active = cycles.find((c) => c.status === "active");
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;

  const cycleForm = (c?: Cycle) => (
    <form action={saveCycle} className="grid gap-3 sm:grid-cols-4">
      {hiddenLine}{c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name" className="sm:col-span-2"><input name="name" required defaultValue={c?.name} className="input" placeholder="Growth Cycle 02 — …" /></Field>
      <Field label="Start"><input name="start_date" type="date" defaultValue={c?.start_date ?? ""} className="input" /></Field>
      <Field label="End"><input name="end_date" type="date" defaultValue={c?.end_date ?? ""} className="input" /></Field>
      <Field label="Primary Constraint" className="sm:col-span-2">
        <select name="constraint_id" defaultValue={c?.constraint_id ?? main?.id ?? ""} className="input">
          <option value="">—</option>{map.map((x) => <option key={x.id} value={x.id}>{x.number}. {x.name}{x.status === "main" ? " — MAIN" : ""}</option>)}
        </select>
      </Field>
      <Field label="Primary Metric" className="sm:col-span-2"><input name="primary_metric" defaultValue={c?.primary_metric} className="input" placeholder="Show → Paid Customer" /></Field>
      <Field label="Baseline"><input name="baseline" defaultValue={c?.baseline} className="input" /></Field>
      <Field label="Target"><input name="target" defaultValue={c?.target} className="input" /></Field>
      <Field label="Economic upside"><input name="economic_upside" defaultValue={c?.economic_upside} className="input" /></Field>
      <Field label="Confidence">
        <select name="confidence" defaultValue={c?.confidence ?? "medium"} className="input"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
      </Field>
      <Field label="Owner"><UserSelect name="owner_id" users={users} value={c?.owner_id} /></Field>
      <Field label="Condition of Victory" className="sm:col-span-3"><input name="condition_of_victory" defaultValue={c?.condition_of_victory} className="input" placeholder="17%+ przez 4 kolejne tygodnie" /></Field>
      <Field label="Root causes" className="sm:col-span-4"><textarea name="root_causes" rows={3} defaultValue={c?.root_causes} className="input" placeholder="Dlaczego ten constraint istnieje?" /></Field>
      {c && <Field label="Result" className="sm:col-span-2"><textarea name="result" rows={2} defaultValue={c.result} className="input" /></Field>}
      {c && <Field label="Retrospective" className="sm:col-span-2"><textarea name="retrospective" rows={2} defaultValue={c.retrospective} className="input" /></Field>}
      <div className="sm:col-span-4"><Submit className="btn-primary">{c ? "Save cycle" : "Create cycle"}</Submit></div>
    </form>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">Growth Cycles</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">Jeden aktywny cykl na linię: jeden Primary Constraint, jedna metryka, maksymalnie {MAX_ACTIVE} aktywne hipotezy i {MAX_ACTIVE} aktywne eksperymenty.</p>
        </div>
      </div>
      {ga && (
        <details>
          <summary className="btn w-fit">+ New Growth Cycle</summary>
          <Card className="mt-3">
            {active && <p role="alert" className="mb-4 rounded-lg border border-watch/30 bg-watch-soft px-3 py-2 text-[13px] text-watch">Ta linia ma już aktywny Primary Constraint w cyklu „{active.name}”. Nowy cykl zostanie utworzony jako PLANNED — aktywujesz go dopiero po zamknięciu obecnego.</p>}
            {cycleForm()}
          </Card>
        </details>
      )}
      {cycles.length === 0 && <Empty>Brak Growth Cycles. Najpierw ustaw MAIN CONSTRAINT, potem otwórz dla niego cykl.</Empty>}
      {cycles.map((c) => {
        const hs = hypotheses.filter((h) => h.cycle_id === c.id);
        const activeHs = hs.filter((h) => ACTIVE_HYPOTHESIS_STATUSES.includes(h.status));
        const es = experiments.filter((e) => e.cycle_id === c.id);
        return (
          <Card key={c.id} className={c.status === "active" ? "border-ink/40" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">{c.start_date ? `${fmtDate(c.start_date)}–${fmtDate(c.end_date)}` : "No dates"}</div>
                <h3 className="mt-0.5 text-[16px] font-semibold tracking-tight">{c.name}</h3>
              </div>
              <Pill tone={c.status === "active" ? "ink" : c.status === "completed" ? "healthy" : c.status === "abandoned" ? "resolved" : undefined}>{titleCase(c.status).toUpperCase()}</Pill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Fact label="Primary Constraint">{c.constraint_name}</Fact>
              <Fact label="Primary Metric">{c.primary_metric}</Fact>
              <Fact label="Baseline → Target">{c.baseline || "—"} → {c.target || "—"}</Fact>
              <Fact label="Owner">{c.owner_name}</Fact>
              <Fact label="Economic upside">{c.economic_upside}</Fact>
              <Fact label="Confidence">{titleCase(c.confidence)}</Fact>
              <Fact label="Condition of Victory" className="col-span-2">{c.condition_of_victory}</Fact>
              {c.root_causes && <Fact label="Root causes" className="col-span-2"><span className="whitespace-pre-wrap text-[13.5px]">{c.root_causes}</span></Fact>}
              {c.result && <Fact label="Result" className="col-span-2"><span className="whitespace-pre-wrap text-[13.5px]">{c.result}</span></Fact>}
              {c.retrospective && <Fact label="Retrospective" className="col-span-2"><span className="whitespace-pre-wrap text-[13.5px]">{c.retrospective}</span></Fact>}
            </div>
            {(hs.length > 0 || es.length > 0) && (
              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <div className="eyebrow mb-1">Hypotheses · {activeHs.length}/{MAX_ACTIVE} active</div>
                  <ul className="space-y-1 text-[13px]">{hs.map((h) => <li key={h.id} className="flex gap-2"><Pill>{titleCase(h.status)}</Pill><Link href={`/b/${line.slug}/hypotheses/${h.id}`} className="hover:underline">{h.statement}</Link></li>)}</ul>
                </div>
                <div>
                  <div className="eyebrow mb-1">Experiments · {es.filter((e) => e.status === "running").length}/{MAX_ACTIVE} running</div>
                  <ul className="space-y-1 text-[13px]">{es.map((e) => <li key={e.id} className="flex gap-2"><Pill>{titleCase(e.status)}</Pill><Link href={`/b/${line.slug}/hypotheses/${e.hypothesis_id}`} className="hover:underline">{e.name}</Link>{e.deadline && <span className="text-muted">do {fmtDate(e.deadline)}</span>}</li>)}</ul>
                </div>
              </div>
            )}
            {ga && (
              <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-line pt-4">
                <details className="w-full">
                  <summary className="btn btn-sm w-fit">Edit</summary>
                  <div className="mt-3">{cycleForm(c)}</div>
                </details>
                {c.status === "planned" && <form action={setCycleStatus}>{hiddenLine}<input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="active" /><Submit className="btn-sm btn-primary">Activate</Submit></form>}
                {c.status === "active" && (
                  <details className="w-full">
                    <summary className="btn btn-sm w-fit">Complete / abandon cycle</summary>
                    <form action={setCycleStatus} className="mt-3 grid gap-3 sm:grid-cols-2">
                      {hiddenLine}<input type="hidden" name="id" value={c.id} />
                      <Field label="Result"><textarea name="result" rows={3} defaultValue={c.result} className="input" placeholder="Czy Condition of Victory została spełniona?" /></Field>
                      <Field label="Retrospective"><textarea name="retrospective" rows={3} defaultValue={c.retrospective} className="input" placeholder="Czego się nauczyliśmy? Co dalej z constraintem?" /></Field>
                      <div className="flex gap-2"><button name="status" value="completed" className="btn btn-primary btn-sm">Complete</button><button name="status" value="abandoned" className="btn btn-sm">Abandon</button></div>
                    </form>
                  </details>
                )}
                {(c.status === "completed" || c.status === "abandoned") && <form action={setCycleStatus}>{hiddenLine}<input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="planned" /><Submit className="btn-sm">Reopen as planned</Submit></form>}
              </div>
            )}
            <details className="mt-4 border-t border-line pt-3">
              <summary className="text-xs text-muted underline underline-offset-2">Comments</summary>
              <div className="mt-3"><Comments line={line} targetType="cycle" targetId={c.id} user={user} role={role} /></div>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
