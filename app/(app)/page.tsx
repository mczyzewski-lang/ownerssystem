import Link from "next/link";
import { Suspense } from "react";
import { listUsers, listVisibleLines, requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getRoadmapStates } from "@/lib/roadmap-data";
import { FRAMEWORK_NAME } from "@/lib/roadmap";
import { createLine } from "@/lib/actions/lines";
import { Flash, Submit } from "@/components/client";
import { Card, Field, PageHeader, Pill, UserSelect } from "@/components/ui";
import { AlignmentPill, DebtPill } from "@/components/roadmap";
import { fmtDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Holding dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const lines = await listVisibleLines(user);
  const ids = lines.map((l) => l.id);
  const [mains, cycles, roadmap, users] = await Promise.all([
    ids.length ? sql`select r.business_line_id, c.name from constraint_reviews r join constraints c on c.id = r.constraint_id
                     where r.status = 'main' and r.business_line_id in ${sql(ids)}` : [],
    ids.length ? sql`select g.business_line_id, g.name, g.primary_metric, g.baseline, g.target, g.start_date, g.end_date, g.status, u.name as owner
                     from growth_cycles g left join users u on u.id = g.owner_id
                     where g.status = 'active' and g.business_line_id in ${sql(ids)}` : [],
    getRoadmapStates(lines),
    listUsers(),
  ]);
  const ga = user.role === "growth_architect";
  const th = "whitespace-nowrap";
  return (
    <div>
      <PageHeader eyebrow="Cross-business view" title="Holding dashboard"
        description="Jedna linia = jeden główny constraint = jeden aktywny Growth Cycle. Co najbardziej ogranicza każdy biznes i skąd to wiemy?" />
      <Suspense><Flash /></Suspense>

      <Card className="!p-0">
        <div className="px-5 pb-2 pt-4"><h2 className="h2">Constraints &amp; Growth Cycles</h2></div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[860px]">
            <thead><tr><th>Business</th><th>Primary Constraint</th><th>Metric</th><th className="text-right">Baseline</th><th className="text-right">Target</th><th>Owner</th><th>Cycle</th><th>Status</th></tr></thead>
            <tbody>
              {lines.map((l) => {
                const main = mains.find((m) => m.business_line_id === l.id);
                const c = cycles.find((x) => x.business_line_id === l.id);
                return (
                  <tr key={l.id} className="hover:bg-sunken/50">
                    <td className={th}><Link href={`/b/${l.slug}`} className="font-medium hover:underline">{l.name}</Link><div className="text-xs text-muted">{l.group_name}</div></td>
                    <td>{main ? <span className="font-medium text-critical">{main.name}</span> : <span className="text-muted">—</span>}</td>
                    <td>{c?.primary_metric || <span className="text-muted">—</span>}</td>
                    <td className="text-right tabular-nums">{c?.baseline || <span className="text-muted">—</span>}</td>
                    <td className="text-right tabular-nums">{c?.target || <span className="text-muted">—</span>}</td>
                    <td className={th}>{c?.owner ?? l.owner_name ?? <span className="text-muted">—</span>}</td>
                    <td className={th + " text-xs text-ink-soft"}>{c ? (c.start_date ? `${fmtDate(c.start_date)}–${fmtDate(c.end_date)}` : c.name) : <span className="text-muted">—</span>}</td>
                    <td>{c ? <Pill tone="ink">{titleCase(c.status)}</Pill> : main ? <Pill tone="watch">No cycle</Pill> : <Pill>Diagnosis</Pill>}</td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">Nie masz jeszcze dostępu do żadnej linii biznesowej.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 !p-0">
        <div className="px-5 pb-2 pt-4">
          <h2 className="h2">Scaling Roadmap</h2>
          <p className="mt-0.5 text-xs text-muted">{FRAMEWORK_NAME}. Soczewka diagnostyczna obok obserwowanego constraintu — nie źródło prawdy.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[860px]">
            <thead><tr><th>Business</th><th>Hormozi Stage</th><th>Primary Constraint</th><th>Alignment</th><th>Stage Debt</th><th>Next Graduation</th></tr></thead>
            <tbody>
              {lines.map((l) => {
                const r = roadmap.get(l.id)!;
                return (
                  <tr key={l.id} className="hover:bg-sunken/50">
                    <td className={th}><Link href={`/b/${l.slug}/roadmap`} className="font-medium hover:underline">{l.name}</Link></td>
                    {r.current ? (
                      <>
                        <td className={th}><span className="tabular-nums text-muted">{r.current.number}</span> <span className="font-medium">{r.current.name}</span></td>
                        <td>{r.observed?.name ?? <span className="text-muted">—</span>}</td>
                        <td><AlignmentPill alignment={r.alignment} short /></td>
                        <td><DebtPill debt={r.debt} /></td>
                        <td className="max-w-xs text-ink-soft">{r.current.graduate_by}</td>
                      </>
                    ) : (
                      <>
                        <td colSpan={1}><Link href={`/b/${l.slug}/roadmap#assessment`} className="text-muted underline decoration-line-strong underline-offset-2">[assessment needed]</Link></td>
                        <td>{r.observed?.name ?? <span className="text-muted">—</span>}</td>
                        <td className="text-muted">—</td><td className="text-muted">—</td><td className="text-muted">—</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {ga && (
        <details className="mt-6">
          <summary className="btn w-fit">+ Add business line</summary>
          <Card className="mt-3 max-w-2xl">
            <form action={createLine} className="grid gap-3 sm:grid-cols-3">
              <Field label="Name"><input name="name" required className="input" /></Field>
              <Field label="Group"><input name="group_name" list="groups" defaultValue="Osobne spółki / marki" className="input" /><datalist id="groups">{[...new Set(lines.map((l) => l.group_name))].map((g) => <option key={g} value={g} />)}</datalist></Field>
              <Field label="Owner"><UserSelect name="owner_id" users={users} /></Field>
              <div><Submit className="btn-primary">Create</Submit></div>
            </form>
          </Card>
        </details>
      )}
    </div>
  );
}
