import Link from "next/link";
import { getLineAccess, listUsers } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getConstraintMap } from "@/lib/line-data";
import { aiConfigured } from "@/lib/ai";
import { addAttachment, deleteAttachment, saveConstraintReview, saveNodeReview, setConstraintStatus } from "@/lib/actions/constraints";
import { linkHypothesisNode, saveHypothesis } from "@/lib/actions/growth";
import { runAiAction } from "@/lib/actions/ai";
import { Comments } from "@/components/comments";
import { ConfirmMain } from "@/components/confirm-main";
import { Submit } from "@/components/client";
import { Card, ConstraintStatusPill, Dot, Field, ItemStatusPill, Pill, UserSelect } from "@/components/ui";
import { cn, CONSTRAINT_STATUS, fmtDate, fmtDateTime, ITEM_STATUS, titleCase } from "@/lib/utils";

export const metadata = { title: "Review" };
export const maxDuration = 120;

type Node = {
  id: string; constraint_id: string; parent_id: string | null; kind: string; code: string | null; title: string; description: string;
  status: string; checked: boolean; note: string; evidence: string; link: string; metric: string; owner_id: string | null;
  updated_at: string | null; updated_by_name: string | null; comments: number; hypotheses: number;
};

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string; n?: string; confirm_main?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { line, role, user } = await getLineAccess(slug);
  const [map, nodes, users] = await Promise.all([
    getConstraintMap(line.id),
    sql<Node[]>`
      select n.id, n.constraint_id, n.parent_id, n.kind, n.code, n.title, n.description,
             coalesce(r.status, 'not_reviewed') as status, coalesce(r.checked, false) as checked, coalesce(r.note, '') as note,
             coalesce(r.evidence, '') as evidence, coalesce(r.link, '') as link, coalesce(r.metric, '') as metric, r.owner_id,
             r.updated_at, u.name as updated_by_name,
             (select count(*)::int from comments cm where cm.business_line_id = ${line.id} and cm.target_type = 'node' and cm.target_id = n.id) as comments,
             (select count(*)::int from hypothesis_node_links l join hypotheses h on h.id = l.hypothesis_id
                where l.node_id = n.id and h.business_line_id = ${line.id}) as hypotheses
      from checklist_nodes n
      left join checklist_reviews r on r.node_id = n.id and r.business_line_id = ${line.id}
      left join users u on u.id = r.updated_by
      where n.archived_at is null order by n.position, n.title`,
    listUsers(),
  ]);
  const ga = role === "growth_architect";
  const canEdit = role !== "viewer";
  const base = `/b/${line.slug}/review`;

  const node = sp.n ? nodes.find((n) => n.id === sp.n) : undefined;
  const constraint = map.find((c) => (node ? c.id === node.constraint_id : c.key === sp.c)) ?? map.find((c) => c.status === "main") ?? map[0];
  const childrenOf = (parentId: string | null, constraintId: string) => nodes.filter((n) => n.constraint_id === constraintId && n.parent_id === parentId);
  const ancestors: Node[] = [];
  for (let p = node; p?.parent_id; ) {
    p = nodes.find((n) => n.id === p!.parent_id);
    if (p) ancestors.unshift(p);
  }
  const openIds = new Set([...ancestors.map((a) => a.id), node?.id]);
  const href = (n: Node) => `${base}?n=${n.id}`;

  // next atomic item in document order — lets you walk the checklist with the owner
  const ordered: Node[] = [];
  const walk = (parentId: string | null, cid: string) => { for (const n of childrenOf(parentId, cid)) { ordered.push(n); walk(n.id, cid); } };
  for (const c of map) walk(null, c.id);
  const idx = node ? ordered.findIndex((n) => n.id === node.id) : -1;
  const nextItem = ordered.slice(idx + 1).find((n) => n.kind === "item" && (node ? true : n.constraint_id === constraint.id));
  const prevItem = idx > 0 ? ordered.slice(0, idx).reverse().find((n) => n.kind === "item") : undefined;

  const [attachments, linked, lineHypotheses] = node
    ? await Promise.all([
        sql`select id, name, url from attachments where business_line_id = ${line.id} and target_type = 'node' and target_id = ${node.id} order by created_at`,
        sql`select h.id, h.statement, h.status from hypothesis_node_links l join hypotheses h on h.id = l.hypothesis_id
            where l.node_id = ${node.id} and h.business_line_id = ${line.id} order by h.created_at`,
        sql`select id, statement from hypotheses where business_line_id = ${line.id} order by created_at desc limit 100`,
      ])
    : [[], [], []];

  const row = (n: Node, depth: number) => (
    <Link key={n.id} href={href(n)} scroll={false} aria-current={node?.id === n.id ? "true" : undefined}
      className={cn("flex items-center gap-2 rounded-md py-1 pr-2 text-[13px] hover:bg-sunken", node?.id === n.id && "bg-sunken font-medium")}
      style={{ paddingLeft: 8 + depth * 14 }}>
      <Dot status={n.status} />
      <span className={cn("min-w-0 flex-1 truncate", n.checked && n.status === "not_reviewed" && "text-muted")}>{n.title}</span>
      {n.hypotheses > 0 && <span title="Linked hypotheses" className="text-[10px] text-muted">H{n.hypotheses}</span>}
      {n.comments > 0 && <span title="Comments" className="rounded-full bg-sunken px-1.5 text-[10px] tabular-nums text-ink-soft">{n.comments}</span>}
    </Link>
  );
  const branch = (n: Node, depth: number): React.ReactNode => {
    const kids = childrenOf(n.id, n.constraint_id);
    if (n.kind === "item" || kids.length === 0) return row(n, depth);
    const done = kids.filter((k) => k.kind === "item" && k.status !== "not_reviewed").length;
    return (
      <details key={n.id} open={openIds.has(n.id)}>
        <summary className={cn("flex items-center gap-2 rounded-md py-1 pr-2 text-[13px] hover:bg-sunken", node?.id === n.id && "bg-sunken")} style={{ paddingLeft: 8 + depth * 14 }}>
          <span aria-hidden className="w-2 text-[9px] text-muted">▸</span>
          <span className="min-w-0 flex-1 truncate font-medium">{n.code ? `${n.code} ` : ""}{n.title}</span>
          <span className="text-[10px] tabular-nums text-muted">{done}/{kids.filter((k) => k.kind === "item").length || kids.length}</span>
          <Link href={href(n)} scroll={false} className="rounded px-1 text-[10px] text-muted underline underline-offset-2 hover:text-ink">open</Link>
        </summary>
        {kids.map((k) => branch(k, depth + 1))}
      </details>
    );
  };

  const pending = sp.confirm_main ? map.find((c) => c.id === sp.confirm_main) : undefined;
  const main = map.find((c) => c.status === "main");
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;

  return (
    <div>
      {pending && main && ga && <ConfirmMain slug={line.slug} current={main} pending={pending} cancelHref={`${base}?c=${pending.key}`} />}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── tree */}
        <aside className="card max-h-[80vh] overflow-y-auto p-2 lg:sticky lg:top-6">
          {map.map((c) => (
            <details key={c.id} open={c.id === constraint.id} className="border-b border-line py-1 last:border-b-0">
              <summary className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken", !node && c.id === constraint.id && "bg-sunken")}>
                <Dot status={c.status} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold tracking-tight">{c.number}. {c.name}</span>
                <span className="text-[10px] tabular-nums text-muted">{c.reviewed}/{c.total}</span>
                <Link href={`${base}?c=${c.key}`} scroll={false} className="rounded px-1 text-[10px] text-muted underline underline-offset-2 hover:text-ink">open</Link>
              </summary>
              <div className="pb-1">{childrenOf(null, c.id).map((n) => branch(n, 1))}</div>
            </details>
          ))}
        </aside>

        {/* ── detail */}
        <div className="min-w-0 space-y-5">
          {!node ? (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">Constraint {constraint.number}{constraint.cross_cutting && " · cross-cutting"}</div>
                    <h2 className="mt-1 text-[20px] font-semibold tracking-tight">{constraint.name}</h2>
                  </div>
                  <ConstraintStatusPill status={constraint.status} />
                </div>
                <p className="mt-2 max-w-2xl text-[13.5px] text-ink-soft">{constraint.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted">
                  <span>{constraint.reviewed}/{constraint.total} items reviewed</span>
                  <span>{constraint.concerns} concerns · {constraint.candidates} candidates</span>
                  <span>Last reviewed: {fmtDate(constraint.last_reviewed_at)}</span>
                </div>
                {ga && (
                  <div className="mt-5 border-t border-line pt-4">
                    <div className="eyebrow mb-2">Status</div>
                    <form action={setConstraintStatus} className="flex flex-wrap items-end gap-2">
                      {hiddenLine}<input type="hidden" name="constraint_id" value={constraint.id} />
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(CONSTRAINT_STATUS).map(([v, s]) => (
                          <label key={v} className={cn("pill cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper", v === "main" && "border-critical/40 text-critical")}>
                            <input type="radio" name="status" value={v} defaultChecked={constraint.status === v} className="sr-only" />{s.label}
                          </label>
                        ))}
                      </div>
                      <input name="reason" placeholder="Reason for the change" className="input !w-64" />
                      <Submit className="btn-primary">Set status</Submit>
                    </form>
                    <form action={saveConstraintReview} className="mt-5 grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
                      {hiddenLine}<input type="hidden" name="constraint_id" value={constraint.id} />
                      <Field label="Score 1–10"><input name="score" type="number" min={1} max={10} defaultValue={constraint.score ?? ""} className="input" /></Field>
                      <Field label="Owner"><UserSelect name="owner_id" users={users} value={constraint.owner_id} /></Field>
                      <div />
                      <Field label="Evidence" className="sm:col-span-3"><textarea name="evidence" rows={3} defaultValue={constraint.evidence} className="input" placeholder="Skąd to wiemy?" /></Field>
                      <Field label="Data" className="sm:col-span-3"><textarea name="data_notes" rows={2} defaultValue={constraint.data_notes} className="input" placeholder="Kluczowe liczby dla tego obszaru" /></Field>
                      <div><Submit>Save review</Submit></div>
                    </form>
                  </div>
                )}
                {!ga && (constraint.evidence || constraint.score != null) && (
                  <div className="mt-4 border-t border-line pt-4 text-[13.5px]"><span className="eyebrow mr-2">Score</span>{constraint.score ?? "—"}/10<p className="mt-2 whitespace-pre-wrap text-ink-soft">{constraint.evidence}</p></div>
                )}
              </Card>
              <Card><Comments line={line} targetType="constraint" targetId={constraint.id} user={user} role={role} /></Card>
              {nextItem && <Link href={href(nextItem)} className="btn">Start review: {nextItem.title} →</Link>}
            </>
          ) : (
            <>
              <Card>
                <nav aria-label="Path" className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  <Link href={`${base}?c=${constraint.key}`} className="hover:text-ink hover:underline">{titleCase(constraint.name.toLowerCase())}</Link>
                  {ancestors.map((a) => <span key={a.id} className="flex items-center gap-1.5">→ <Link href={href(a)} className="hover:text-ink hover:underline">{a.title}</Link></span>)}
                </nav>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-[19px] font-semibold leading-snug tracking-tight">{node.code ? `${node.code} ` : ""}{node.title}</h2>
                  <div className="flex items-center gap-2"><Pill>{titleCase(node.kind)}</Pill><ItemStatusPill status={node.status} /></div>
                </div>
                {node.description && <p className="mt-2 text-[13px] text-muted">{node.description}</p>}

                <form action={saveNodeReview} className="mt-5 space-y-4">
                  {hiddenLine}<input type="hidden" name="node_id" value={node.id} />
                  <fieldset disabled={!canEdit} className="space-y-4">
                    <div>
                      <div className="label">Status</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(ITEM_STATUS).map(([v, s]) => (
                          <label key={v} className="pill cursor-pointer !px-3 !py-1 text-[12px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper">
                            <input type="radio" name="status" value={v} defaultChecked={node.status === v} className="sr-only" />{s.label}
                          </label>
                        ))}
                        <label className="ml-2 flex items-center gap-2 text-[13px] text-ink-soft"><input type="checkbox" name="checked" defaultChecked={node.checked} className="h-4 w-4 accent-[#23221f]" /> Checked / applies</label>
                      </div>
                    </div>
                    <Field label="Note"><textarea name="note" rows={3} defaultValue={node.note} className="input" placeholder="Notatka z review" /></Field>
                    <Field label="Evidence"><textarea name="evidence" rows={2} defaultValue={node.evidence} className="input" placeholder="Dowody: dane, obserwacje, nagrania" /></Field>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Metric"><input name="metric" defaultValue={node.metric} className="input" /></Field>
                      <Field label="Link"><input name="link" type="url" defaultValue={node.link} className="input" placeholder="https://…" /></Field>
                      <Field label="Owner"><UserSelect name="owner_id" users={users} value={node.owner_id} /></Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {canEdit && <Submit className="btn-primary">Save</Submit>}
                      {prevItem && <Link href={href(prevItem)} scroll={false} className="btn btn-ghost">← Previous</Link>}
                      {nextItem && <Link href={href(nextItem)} scroll={false} className="btn btn-ghost">Next item →</Link>}
                      <span className="ml-auto text-xs text-muted">Last update: {node.updated_at ? `${fmtDateTime(node.updated_at)}${node.updated_by_name ? ` · ${node.updated_by_name}` : ""}` : "—"}</span>
                    </div>
                  </fieldset>
                </form>
              </Card>

              {node.kind !== "item" && (
                <Card>
                  <h3 className="eyebrow mb-2">Contents</h3>
                  <ul className="divide-y divide-line">
                    {childrenOf(node.id, node.constraint_id).map((k) => (
                      <li key={k.id}><Link href={href(k)} scroll={false} className="flex items-center gap-3 py-2 text-[13.5px] hover:underline"><Dot status={k.status} /><span className="flex-1">{k.title}</span>{k.note && <span className="hidden max-w-xs truncate text-xs text-muted sm:inline">{k.note}</span>}{k.comments > 0 && <span className="text-xs text-muted">{k.comments} 💬</span>}</Link></li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card>
                <h3 className="eyebrow mb-2">Related hypotheses</h3>
                {linked.length === 0 && <p className="text-[13px] text-muted">Brak powiązanych hipotez.</p>}
                <ul className="space-y-1.5">
                  {linked.map((h) => (
                    <li key={h.id} className="flex items-start gap-2 text-[13.5px]">
                      <Pill>{titleCase(h.status)}</Pill>
                      <Link href={`/b/${line.slug}/hypotheses/${h.id}`} className="flex-1 hover:underline">{h.statement}</Link>
                      {canEdit && (
                        <form action={linkHypothesisNode}>{hiddenLine}<input type="hidden" name="hypothesis_id" value={h.id} /><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="unlink" value="1" />
                          <button className="text-xs text-muted underline underline-offset-2">unlink</button></form>
                      )}
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap gap-4">
                    <details>
                      <summary className="btn btn-sm">+ New hypothesis from this item</summary>
                      <form action={saveHypothesis} className="mt-2 w-[28rem] max-w-full space-y-2">
                        {hiddenLine}<input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="constraint_id" value={constraint.id} />
                        <input type="hidden" name="status" value="idea" /><input type="hidden" name="stay" value="1" />
                        <textarea name="statement" required rows={3} className="input" placeholder="Jeśli zrobimy X, to metryka Y zmieni się o Z, ponieważ…" />
                        <Submit className="btn-sm btn-primary">Add hypothesis</Submit>
                      </form>
                    </details>
                    {lineHypotheses.length > 0 && (
                      <form action={linkHypothesisNode} className="flex items-center gap-2">
                        {hiddenLine}<input type="hidden" name="node_id" value={node.id} />
                        <select name="hypothesis_id" aria-label="Existing hypothesis" className="input !w-64 !py-1 text-xs">
                          {lineHypotheses.map((h) => <option key={h.id} value={h.id}>{h.statement.slice(0, 80)}</option>)}
                        </select>
                        <Submit className="btn-sm">Link existing</Submit>
                      </form>
                    )}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="eyebrow mb-2">Attachments / links</h3>
                <ul className="space-y-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 text-[13.5px]">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2">{a.name}</a>
                      {canEdit && <form action={deleteAttachment}>{hiddenLine}<input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted underline underline-offset-2">remove</button></form>}
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <form action={addAttachment} className="mt-2 flex flex-wrap gap-2">
                    {hiddenLine}<input type="hidden" name="target_type" value="node" /><input type="hidden" name="target_id" value={node.id} />
                    <input name="name" placeholder="Name" aria-label="Attachment name" className="input !w-44" />
                    <input name="url" type="url" required placeholder="https://… (Drive, CRM, nagranie)" aria-label="Attachment URL" className="input !w-72" />
                    <Submit className="btn-sm">Add link</Submit>
                  </form>
                )}
              </Card>

              {ga && (
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="eyebrow">AI</h3><p className="text-[13px] text-muted">Analiza tego elementu w kontekście wszystkich danych linii. Wynik trafia do Growth AI Chat.</p></div>
                    {aiConfigured() ? (
                      <form action={runAiAction}>{hiddenLine}<input type="hidden" name="action" value="analyze_item" /><input type="hidden" name="node_id" value={node.id} /><Submit pendingText="AI analizuje…">Analyze this item</Submit></form>
                    ) : <span className="text-xs text-muted">AI not configured</span>}
                  </div>
                </Card>
              )}

              <Card><Comments line={line} targetType="node" targetId={node.id} user={user} role={role} /></Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
