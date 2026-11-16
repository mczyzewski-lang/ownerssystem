import Link from "next/link";
import { getLineAccess, listUsers } from "@/lib/auth";
import { getConstraintMap, listConstraints } from "@/lib/line-data";
import { getHypotheses, getSectionOptions } from "@/lib/growth-data";
import { HypothesisForm } from "@/components/hypothesis-form";
import { Card, Empty, Pill } from "@/components/ui";
import { ACTIVE_HYPOTHESIS_STATUSES, cn, HYPOTHESIS_STATUSES, hypothesisScore, MAX_ACTIVE, titleCase } from "@/lib/utils";

export const metadata = { title: "Hypotheses" };

const TONE: Record<string, string> = { testing: "ink", prioritized: "watch", won: "healthy", implemented: "healthy", lost: "resolved", inconclusive: "resolved" };

export default async function HypothesesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string }> }) {
  const { slug } = await params;
  const { status } = await searchParams;
  const { line, role } = await getLineAccess(slug);
  const [all, constraints, sections, users, map] = await Promise.all([getHypotheses(line.id), listConstraints(), getSectionOptions(), listUsers(), getConstraintMap(line.id)]);
  const main = map.find((c) => c.status === "main");
  const active = all.filter((h) => ACTIVE_HYPOTHESIS_STATUSES.includes(h.status));
  const rows = (status ? all.filter((h) => h.status === status) : all)
    .map((h) => ({ ...h, score: hypothesisScore(h) }))
    .sort((a, b) => Number(ACTIVE_HYPOTHESIS_STATUSES.includes(b.status)) - Number(ACTIVE_HYPOTHESIS_STATUSES.includes(a.status)) || b.score - a.score);
  const base = `/b/${line.slug}/hypotheses`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">Hypotheses</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Jeden główny constraint → hipotezy dotyczące tego constraintu → eksperymenty → wynik. Score = Impact × Confidence × Speed to Learn ÷ Effort.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted">Active</span>
          <span className={cn("pill", active.length >= MAX_ACTIVE && "pill-watch")}>{active.length} / {MAX_ACTIVE}</span>
          {main && <Pill tone="critical">{main.name}</Pill>}
        </div>
      </div>

      {role !== "viewer" && (
        <details>
          <summary className="btn w-fit">+ New hypothesis</summary>
          <Card className="mt-3"><HypothesisForm slug={line.slug} constraints={constraints} sections={sections} users={users} mainId={main?.id} /></Card>
        </details>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Link href={base} className={cn("pill", !status && "pill-ink")}>All · {all.length}</Link>
        {HYPOTHESIS_STATUSES.map((s) => {
          const n = all.filter((h) => h.status === s).length;
          return <Link key={s} href={`${base}?status=${s}`} className={cn("pill", status === s && "pill-ink", n === 0 && "opacity-50")}>{titleCase(s)} · {n}</Link>;
        })}
      </div>

      {rows.length === 0 ? <Empty>Brak hipotez{status ? " w tym statusie" : ""}. Hipotezy dodawaj dopiero po zdiagnozowaniu constraintu.</Empty> : (
        <Card className="overflow-x-auto !p-0">
          <table className="tbl min-w-[980px]">
            <thead><tr><th>Hypothesis</th><th>Constraint</th><th>Expected impact</th><th className="text-right">Conf.</th><th className="text-right">Effort</th><th className="text-right">Speed</th><th className="text-right">Score</th><th>Economic upside</th><th>Owner</th><th>Status</th><th>Experiment</th><th>Result</th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="hover:bg-sunken/50">
                  <td className="max-w-sm"><Link href={`${base}/${h.id}`} className="font-medium hover:underline">{h.statement}</Link></td>
                  <td className="text-xs">{h.constraint_name ?? "—"}{h.node_title && <div className="text-muted">{h.node_title}</div>}{main && h.constraint_id !== main.id && <div className="text-watch">not the main constraint</div>}</td>
                  <td>{h.expected_impact || "—"}</td>
                  <td className="text-right tabular-nums">{h.confidence}/10</td>
                  <td className="text-right tabular-nums">{h.effort}/10</td>
                  <td className="text-right tabular-nums">{h.speed}/10</td>
                  <td className="text-right font-semibold tabular-nums">{h.score}</td>
                  <td>{h.economic_upside || "—"}</td>
                  <td className="whitespace-nowrap">{h.owner_name ?? "—"}</td>
                  <td><Pill tone={TONE[h.status]}>{titleCase(h.status)}</Pill></td>
                  <td className="whitespace-nowrap text-xs">{h.experiments ? `${h.experiments}${h.running ? ` · ${h.running} running` : ""}` : "—"}</td>
                  <td className="max-w-[10rem] text-xs text-ink-soft">{h.result || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
