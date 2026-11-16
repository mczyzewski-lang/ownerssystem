import Link from "next/link";
import { getLineAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getConstraintMap, getCycles } from "@/lib/line-data";
import { getHypotheses } from "@/lib/growth-data";
import { addComment, setCommentStatus } from "@/lib/actions/comments";
import { PrimaryConstraint } from "@/components/primary";
import { Submit } from "@/components/client";
import { Card, Fact, Pill } from "@/components/ui";
import { ACTIVE_HYPOTHESIS_STATUSES, fmtDate, fmtDateTime, titleCase } from "@/lib/utils";

export const metadata = { title: "Owner Workspace" };

type C = { id: string; kind: string; body: string; created_at: string; author: string | null; target_type: string; target_id: string; target: string | null; ckey: string | null };

export default async function Workspace({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { line, role, user } = await getLineAccess(slug);
  const ga = role === "growth_architect";
  const viewerId = ga ? (line.owner_id ?? user.id) : user.id; // GA previews the owner's view
  const [map, cycles, hypotheses, experiments, open, todo] = await Promise.all([
    getConstraintMap(line.id), getCycles(line.id), getHypotheses(line.id),
    sql`select e.id, e.hypothesis_id, e.name, e.metric, e.baseline, e.target, e.deadline, e.status, u.name as owner
        from experiments e left join users u on u.id = e.owner_id where e.business_line_id = ${line.id} and e.status in ('running', 'planned') order by e.deadline nulls last`,
    sql<(C & { mentions: string[] })[]>`
      select cm.id, cm.kind, cm.body, cm.created_at, cm.mentions, u.name as author, cm.target_type, cm.target_id,
             coalesce(n.title, c.name, h.statement) as target, c.key as ckey
      from comments cm left join users u on u.id = cm.author_id
      left join checklist_nodes n on cm.target_type = 'node' and n.id = cm.target_id
      left join constraints c on cm.target_type = 'constraint' and c.id = cm.target_id
      left join hypotheses h on cm.target_type = 'hypothesis' and h.id = cm.target_id
      where cm.business_line_id = ${line.id} and cm.status = 'open'
        and (cm.kind in ('question', 'data_request') or ${viewerId} = any(cm.mentions))
      order by cm.created_at desc limit 60`,
    sql`select n.id, n.title, c.name as constraint_name from checklist_reviews r join checklist_nodes n on n.id = r.node_id
        join constraints c on c.id = n.constraint_id
        where r.business_line_id = ${line.id} and r.owner_id = ${viewerId} and r.status = 'not_reviewed' order by c.number, n.position limit 30`,
  ]);
  const main = map.find((c) => c.status === "main");
  const cycle = cycles.find((c) => c.status === "active");
  const active = hypotheses.filter((h) => ACTIVE_HYPOTHESIS_STATUSES.includes(h.status));
  const questions = open.filter((c) => c.kind === "question");
  const requests = open.filter((c) => c.kind === "data_request");
  const mentions = open.filter((c) => c.kind === "comment");
  const canReply = role !== "viewer";
  const base = `/b/${line.slug}`;
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;

  const link = (c: C) =>
    c.target_type === "node" ? `${base}/review?n=${c.target_id}` : c.target_type === "constraint" ? `${base}/review?c=${c.ckey}` :
    c.target_type === "hypothesis" ? `${base}/hypotheses/${c.target_id}` : c.target_type === "cycle" ? `${base}/cycles` : null;

  const item = (c: C) => (
    <li key={c.id} className="py-3">
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span className="font-medium text-ink">{c.author}</span><time>{fmtDateTime(c.created_at)}</time>
        {link(c) && <Link href={link(c)!} className="underline underline-offset-2">↗ {c.target}</Link>}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[13.5px]">{c.body}</p>
      {canReply && (
        <div className="mt-2 flex flex-wrap items-start gap-3 text-xs">
          <details>
            <summary className="underline underline-offset-2">Reply</summary>
            <form action={addComment} className="mt-2 w-80 max-w-full space-y-2">
              {hiddenLine}<input type="hidden" name="target_type" value={c.target_type} /><input type="hidden" name="target_id" value={c.target_id} /><input type="hidden" name="parent_id" value={c.id} />
              <textarea name="body" required rows={2} className="input" /><Submit className="btn-sm">Reply</Submit>
            </form>
          </details>
          <form action={setCommentStatus}>{hiddenLine}<input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="resolved" /><button className="underline underline-offset-2">Mark as done</button></form>
        </div>
      )}
    </li>
  );
  const section = (title: string, items: C[], empty: string, kind?: string) => (
    <Card>
      <h2 className="h2">{title} {items.length > 0 && <span className="ml-1 text-muted">{items.length}</span>}</h2>
      {items.length === 0 ? <p className="mt-2 text-[13px] text-muted">{empty}</p> : <ul className="mt-1 divide-y divide-line">{items.map(item)}</ul>}
      {ga && kind && (
        <form action={addComment} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {hiddenLine}<input type="hidden" name="target_type" value="business_line" /><input type="hidden" name="target_id" value={line.id} /><input type="hidden" name="kind" value={kind} />
          <input name="body" required className="input flex-1" placeholder={kind === "question" ? "Zadaj pytanie ownerowi…" : "Poproś o dane…"} aria-label={title} />
          <Submit className="btn-sm">Add</Submit>
        </form>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      {ga && <p className="rounded-lg border border-line bg-sunken px-4 py-2.5 text-[13px] text-ink-soft">Podgląd widoku ownera. <Link href={base} className="underline underline-offset-2">FULL DIAGNOSTIC MODE →</Link></p>}

      <section>
        <h2 className="eyebrow mb-2">This Cycle</h2>
        <PrimaryConstraint slug={line.slug} main={main} cycle={cycle} compact />
      </section>

      <section>
        <h2 className="eyebrow mb-2">This Week</h2>
        {active.length === 0 ? <Card><p className="text-[13px] text-muted">Brak aktywnych hipotez. Growth Architect wybiera maksymalnie 3 hipotezy do testowania w cyklu.</p></Card> : (
          <div className="grid gap-3 lg:grid-cols-3">
            {active.map((h, i) => {
              const es = experiments.filter((e) => e.hypothesis_id === h.id);
              return (
                <Card key={h.id}>
                  <div className="flex items-center justify-between"><span className="eyebrow">Active hypothesis #{i + 1}</span><Pill>{titleCase(h.status)}</Pill></div>
                  <Link href={`${base}/hypotheses/${h.id}`} className="mt-2 block text-[14px] font-medium leading-snug hover:underline">{h.statement}</Link>
                  {es.length === 0 ? <p className="mt-3 text-[13px] text-muted">Brak eksperymentu — <Link href={`${base}/hypotheses/${h.id}`} className="underline underline-offset-2">dodaj</Link>.</p> : es.map((e) => (
                    <div key={e.id} className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                      <Fact label="Experiment" className="col-span-2">{e.name}</Fact>
                      <Fact label="Owner">{e.owner ?? h.owner_name}</Fact>
                      <Fact label="Deadline">{fmtDate(e.deadline)}</Fact>
                      <Fact label="Metric" className="col-span-2">{e.metric}{e.baseline && ` · ${e.baseline} → ${e.target}`}</Fact>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {section("Questions from Growth Architect", questions, "Brak otwartych pytań.", "question")}
        <div className="space-y-4">
          {section("Data to complete", requests, "Brak próśb o dane.", "data_request")}
          {todo.length > 0 && (
            <Card>
              <h2 className="h2">Checklist items assigned to you <span className="ml-1 text-muted">{todo.length}</span></h2>
              <ul className="mt-2 space-y-1 text-[13.5px]">{todo.map((t) => <li key={t.id}><Link href={`${base}/review?n=${t.id}`} className="hover:underline">{t.title}</Link> <span className="text-xs text-muted">· {t.constraint_name}</span></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
      {section("Comments requiring response", mentions, "Nikt nie czeka na Twoją odpowiedź.")}
      <div className="flex flex-wrap gap-2">
        <Link href={`${base}/data`} className="btn">Add data</Link>
        <Link href={`${base}/hypotheses`} className="btn">Add hypothesis</Link>
        <Link href={`${base}/review`} className="btn">Open checklist review</Link>
      </div>
    </div>
  );
}
