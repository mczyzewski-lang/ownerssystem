import Link from "next/link";
import { listVisibleLines, requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Empty, PageHeader, Pill } from "@/components/ui";
import { fmtDate, truncate } from "@/lib/utils";

export const metadata = { title: "Search" };

type Hit = { kind: string; line_id: string; id: string; ref: string | null; title: string; snippet: string; at: string | null };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").trim();
  const lines = await listVisibleLines(user, true);
  const ids = lines.map((l) => l.id);
  let hits: Hit[] = [];
  if (q.length >= 2 && ids.length) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    hits = await sql<Hit[]>`
      select * from (
        select 'Comment' as kind, cm.business_line_id as line_id, cm.target_id as id, cm.target_type as ref,
               coalesce(n.title, c.name, h.statement, 'Comment') as title, cm.body as snippet, cm.created_at as at
          from comments cm left join checklist_nodes n on cm.target_type = 'node' and n.id = cm.target_id
          left join constraints c on cm.target_type = 'constraint' and c.id = cm.target_id
          left join hypotheses h on cm.target_type = 'hypothesis' and h.id = cm.target_id
          where cm.body ilike ${like}
        union all
        select 'Checklist note', r.business_line_id, r.node_id, 'node', n.title, concat_ws(' · ', nullif(r.note, ''), nullif(r.evidence, ''), nullif(r.metric, '')), r.updated_at
          from checklist_reviews r join checklist_nodes n on n.id = r.node_id
          where r.note ilike ${like} or r.evidence ilike ${like} or r.metric ilike ${like}
        union all
        select 'Constraint', b.id, c.id, c.key, c.name, c.description, null
          from constraints c cross join business_lines b
          where b.id = (select id from business_lines where id in ${sql(ids)} order by position limit 1)
            and (c.name ilike ${like} or c.description ilike ${like})
        union all
        select 'Checklist item', b.id, n.id, 'template', n.title, c.name, null
          from checklist_nodes n join constraints c on c.id = n.constraint_id cross join business_lines b
          where b.id = (select id from business_lines where id in ${sql(ids)} order by position limit 1) and n.title ilike ${like}
        union all
        select 'Constraint review', r.business_line_id, c.id, c.key, c.name, concat_ws(' · ', nullif(r.evidence, ''), nullif(r.data_notes, '')), r.last_reviewed_at
          from constraint_reviews r join constraints c on c.id = r.constraint_id where r.evidence ilike ${like} or r.data_notes ilike ${like}
        union all
        select 'Hypothesis', h.business_line_id, h.id, null, h.statement, concat_ws(' · ', nullif(h.expected_impact, ''), nullif(h.result, '')), h.created_at
          from hypotheses h where h.statement ilike ${like} or h.result ilike ${like} or h.expected_impact ilike ${like}
        union all
        select 'Experiment', e.business_line_id, e.hypothesis_id, null, e.name, concat_ws(' · ', nullif(e.design, ''), nullif(e.result, '')), e.created_at
          from experiments e where e.name ilike ${like} or e.design ilike ${like} or e.result ilike ${like}
        union all
        select 'AI chat', v.business_line_id, v.id, null, v.title, m.content, m.created_at
          from ai_messages m join ai_conversations v on v.id = m.conversation_id where m.content ilike ${like} or v.title ilike ${like}
        union all
        select 'Decision', d.business_line_id, d.id, null, d.decision, concat_ws(' · ', nullif(d.why, ''), nullif(d.evidence, ''), nullif(d.result, '')), d.decision_date::timestamptz
          from decisions d where d.decision ilike ${like} or d.why ilike ${like} or d.evidence ilike ${like} or d.result ilike ${like}
        union all
        select 'Metric', m.business_line_id, m.id, null, m.name, concat_ws(' ', m.value, m.unit, m.note), m.created_at
          from metrics m where m.name ilike ${like} or m.note ilike ${like}
        union all
        select 'Growth Cycle', g.business_line_id, g.id, null, g.name, concat_ws(' · ', g.primary_metric, nullif(g.root_causes, ''), nullif(g.result, ''), nullif(g.retrospective, '')), g.created_at
          from growth_cycles g where g.name ilike ${like} or g.root_causes ilike ${like} or g.result ilike ${like} or g.retrospective ilike ${like} or g.primary_metric ilike ${like}
        union all
        select 'Data import', d.business_line_id, d.id, null, d.name, d.raw_content, d.created_at
          from data_imports d where d.name ilike ${like} or d.raw_content ilike ${like} or d.description ilike ${like}
      ) x where x.line_id in ${sql(ids)}
      order by x.at desc nulls last limit 200`;
  }
  const lineOf = new Map(lines.map((l) => [l.id, l]));
  const template = (h: Hit) => h.kind === "Constraint" || h.kind === "Checklist item";
  const href = (h: Hit, slug: string) => {
    const b = `/b/${slug}`;
    switch (h.kind) {
      case "Comment": return h.ref === "node" ? `${b}/review?n=${h.id}` : h.ref === "hypothesis" ? `${b}/hypotheses/${h.id}` : h.ref === "cycle" ? `${b}/cycles` : h.ref === "business_line" ? `${b}/workspace` : `${b}/review`;
      case "Checklist note": case "Checklist item": return `${b}/review?n=${h.id}`;
      case "Constraint": case "Constraint review": return `${b}/review?c=${h.ref}`;
      case "Hypothesis": case "Experiment": return `${b}/hypotheses/${h.id}`;
      case "AI chat": return `${b}/ai?c=${h.id}`;
      case "Decision": return `${b}/decisions`;
      case "Growth Cycle": return `${b}/cycles`;
      default: return `${b}/data`;
    }
  };
  const snippet = (s: string) => {
    const i = s.toLowerCase().indexOf(q.toLowerCase());
    const start = Math.max(0, i - 80);
    return (start > 0 ? "…" : "") + truncate(s.slice(start), 240);
  };
  const groups = [...new Set(hits.map((h) => (template(h) ? "Taxonomy (all business lines)" : (lineOf.get(h.line_id)?.name ?? "?"))))];
  return (
    <div>
      <PageHeader title="Search" description="Komentarze, constrainty, hipotezy, eksperymenty, rozmowy z AI, decyzje, metryki i dane." />
      <form className="mb-6 flex max-w-xl gap-2"><input name="q" type="search" defaultValue={q} autoFocus placeholder="np. success fee" aria-label="Search query" className="input" /><button className="btn btn-primary">Search</button></form>
      {q.length < 2 ? <Empty>Wpisz co najmniej 2 znaki.</Empty> : hits.length === 0 ? <Empty>Brak wyników dla „{q}”.</Empty> : (
        <div className="space-y-6">
          <p className="text-xs text-muted">{hits.length} wyników</p>
          {groups.map((g) => (
            <section key={g}>
              <h2 className="h2 mb-2">{g}</h2>
              <Card className="divide-y divide-line !p-0">
                {hits.filter((h) => (template(h) ? "Taxonomy (all business lines)" : lineOf.get(h.line_id)?.name) === g).map((h, i) => (
                  <Link key={i} href={href(h, lineOf.get(h.line_id)!.slug)} className="block px-4 py-3 hover:bg-sunken/50">
                    <div className="flex flex-wrap items-center gap-2"><Pill>{h.kind}</Pill><span className="text-[13.5px] font-medium">{truncate(h.title, 120)}</span>{h.at && <span className="ml-auto text-xs text-muted">{fmtDate(h.at)}</span>}</div>
                    {h.snippet && <p className="mt-1 text-[13px] text-ink-soft">{snippet(h.snippet)}</p>}
                  </Link>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
