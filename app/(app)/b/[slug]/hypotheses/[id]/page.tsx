import Link from "next/link";
import { notFound } from "next/navigation";
import { getLineAccess, listUsers } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getConstraintMap, listConstraints } from "@/lib/line-data";
import { getHypotheses, getSectionOptions } from "@/lib/growth-data";
import { saveExperiment } from "@/lib/actions/growth";
import { isUuid } from "@/lib/action-utils";
import { HypothesisForm } from "@/components/hypothesis-form";
import { Comments } from "@/components/comments";
import { Submit } from "@/components/client";
import { Card, Field, Pill, UserSelect } from "@/components/ui";
import { hypothesisScore, titleCase } from "@/lib/utils";

export const metadata = { title: "Hypothesis" };

type Exp = { id?: string; name?: string; design?: string; metric?: string; baseline?: string; target?: string; start_date?: string | null; deadline?: string | null; owner_id?: string | null; status?: string; result?: string };

export default async function HypothesisPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!isUuid(id)) notFound();
  const { line, role, user } = await getLineAccess(slug);
  const [all, constraints, sections, users, map, experiments, links] = await Promise.all([
    getHypotheses(line.id), listConstraints(), getSectionOptions(), listUsers(), getConstraintMap(line.id),
    sql<Required<Exp>[]>`select * from experiments where hypothesis_id = ${id} and business_line_id = ${line.id} order by created_at`,
    sql`select n.id, n.title from hypothesis_node_links l join checklist_nodes n on n.id = l.node_id where l.hypothesis_id = ${id}`,
  ]);
  const h = all.find((x) => x.id === id);
  if (!h) notFound();
  const canEdit = role !== "viewer";
  const main = map.find((c) => c.status === "main");

  const experimentForm = (e: Exp = {}) => (
    <form action={saveExperiment} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="line" value={line.slug} /><input type="hidden" name="hypothesis_id" value={h.id} />{e.id && <input type="hidden" name="id" value={e.id} />}
      <fieldset disabled={!canEdit} className="contents">
        <Field label="Experiment" className="sm:col-span-2"><input name="name" required defaultValue={e.name} className="input" /></Field>
        <Field label="Owner"><UserSelect name="owner_id" users={users} value={e.owner_id} /></Field>
        <Field label="Status">
          <select name="status" defaultValue={e.status ?? "planned"} className="input">{["planned", "running", "completed", "stopped"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
        </Field>
        <Field label="Design" className="sm:col-span-4"><textarea name="design" rows={2} defaultValue={e.design} className="input" placeholder="Co dokładnie testujemy, na jakim ruchu, jak długo" /></Field>
        <Field label="Metric"><input name="metric" defaultValue={e.metric} className="input" /></Field>
        <Field label="Baseline"><input name="baseline" defaultValue={e.baseline} className="input" /></Field>
        <Field label="Target"><input name="target" defaultValue={e.target} className="input" /></Field>
        <Field label="Deadline"><input name="deadline" type="date" defaultValue={e.deadline ?? ""} className="input" /></Field>
        <Field label="Result" className="sm:col-span-4"><textarea name="result" rows={2} defaultValue={e.result} className="input" /></Field>
        {canEdit && <div><Submit className="btn-sm btn-primary">{e.id ? "Save experiment" : "Add experiment"}</Submit></div>}
      </fieldset>
    </form>
  );

  return (
    <div className="space-y-5">
      <Link href={`/b/${line.slug}/hypotheses`} className="text-xs text-muted underline underline-offset-2">← All hypotheses</Link>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Pill tone="ink">{titleCase(h.status)}</Pill>
          <span className="text-[13px] text-muted">Score <b className="text-ink">{hypothesisScore(h)}</b> = {h.impact} × {h.confidence} × {h.speed} ÷ {h.effort}</span>
          {links.map((l) => <Link key={l.id} href={`/b/${line.slug}/review?n=${l.id}`} className="pill hover:underline">↗ {l.title}</Link>)}
        </div>
        {canEdit ? <HypothesisForm slug={line.slug} h={h} constraints={constraints} sections={sections} users={users} mainId={main?.id} /> : <p className="text-[15px]">{h.statement}</p>}
      </Card>
      <Card>
        <h3 className="h2 mb-3">Experiments</h3>
        {experiments.length === 0 && <p className="mb-3 text-[13px] text-muted">Brak eksperymentów. Hipoteza bez eksperymentu to tylko opinia.</p>}
        <div className="space-y-3">
          {experiments.map((e) => (
            <details key={e.id} className="rounded-lg border border-line">
              <summary className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-[13.5px] font-medium">{e.name}</span>
                <span className="text-xs text-muted">{e.metric} {e.baseline && `${e.baseline} → ${e.target}`}</span>
                <Pill tone={e.status === "running" ? "ink" : undefined}>{titleCase(e.status)}</Pill>
              </summary>
              <div className="border-t border-line p-4">{experimentForm(e)}</div>
            </details>
          ))}
        </div>
        {canEdit && <details className="mt-3"><summary className="btn btn-sm w-fit">+ Add experiment</summary><div className="mt-3 rounded-lg border border-line p-4">{experimentForm()}</div></details>}
      </Card>
      <Card><Comments line={line} targetType="hypothesis" targetId={h.id} user={user} role={role} /></Card>
    </div>
  );
}
