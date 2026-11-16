import Link from "next/link";
import { getLineAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AI_ACTIONS, AI_NOT_CONFIGURED, aiConfigured } from "@/lib/ai";
import { runAiAction, sendChatMessage } from "@/lib/actions/ai";
import { isUuid } from "@/lib/action-utils";
import { Markdown } from "@/components/markdown";
import { Submit } from "@/components/client";
import { Card, Empty, Fact } from "@/components/ui";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Growth AI" };
export const maxDuration = 120;

const GROUPS: [string, string][] = [["diagnosis", "Diagnosis"], ["analysis", "Analysis"], ["hypotheses", "Hypotheses"], ["session", "Growth Session"], ["roadmap", "Scaling Roadmap"]];

export default async function AiPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { line, role } = await getLineAccess(slug);
  const conversations = await sql`
    select v.id, v.title, v.created_at, v.constraint_snapshot, v.cycle_snapshot, v.action,
           (select count(*)::int from ai_messages m where m.conversation_id = v.id) as messages,
           (select string_agg(distinct u.name, ', ') from ai_messages m join users u on u.id = m.author_id where m.conversation_id = v.id) as participants
    from ai_conversations v where v.business_line_id = ${line.id} order by v.updated_at desc`;
  const current = isUuid(sp.c) ? conversations.find((c) => c.id === sp.c) : undefined;
  const messages = current
    ? await sql`select m.id, m.role, m.content, m.created_at, u.name as author from ai_messages m left join users u on u.id = m.author_id
                where m.conversation_id = ${current.id} order by m.created_at`
    : [];
  const ga = role === "growth_architect";
  const canChat = role !== "viewer";
  const ai = aiConfigured();
  const base = `/b/${line.slug}/ai`;
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <Link href={base} className="btn w-full">+ New conversation</Link>
        <div className="card max-h-[70vh] divide-y divide-line overflow-y-auto">
          {conversations.length === 0 && <p className="px-3 py-4 text-[13px] text-muted">Brak rozmów. Historia zapisuje się na stałe.</p>}
          {conversations.map((c) => (
            <Link key={c.id} href={`${base}?c=${c.id}`} className={cn("block px-3 py-2.5 hover:bg-sunken/60", current?.id === c.id && "bg-sunken")}>
              <div className="truncate text-[13px] font-medium">{c.title}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
                <span>{fmtDate(c.created_at)}</span><span>{c.messages} msgs</span>{c.constraint_snapshot && <span>· {c.constraint_snapshot}</span>}
              </div>
            </Link>
          ))}
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {!ai && <p role="status" className="rounded-lg border border-line-strong bg-sunken px-4 py-3 text-[13px] text-ink-soft">{AI_NOT_CONFIGURED} Historia rozmów pozostaje dostępna.</p>}

        {!current && ga && (
          <Card>
            <h2 className="h2">AI actions</h2>
            <p className="mt-0.5 text-[13px] text-muted">AI jest partnerem diagnostycznym: nie zmienia constraintu ani etapu — tylko analizuje i rekomenduje. Każda akcja zapisuje się jako rozmowa.</p>
            <div className="mt-4 space-y-4">
              {GROUPS.map(([g, label]) => (
                <div key={g}>
                  <div className="eyebrow mb-1.5">{label}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(AI_ACTIONS).filter(([k, a]) => a.group === g && !a.input && k !== "analyze_item" && k !== "explain_mismatch").map(([k, a]) => (
                      <form key={k} action={runAiAction}>{hiddenLine}<input type="hidden" name="action" value={k} /><Submit pendingText="AI analizuje…">{a.label}</Submit></form>
                    ))}
                  </div>
                </div>
              ))}
              <form action={runAiAction} className="space-y-2 border-t border-line pt-4">
                {hiddenLine}<input type="hidden" name="action" value="summarize_session" />
                <div className="eyebrow">Summarize Growth Session</div>
                <textarea name="input" rows={4} required className="input" placeholder="Wklej notatki ze spotkania — AI zapisze: decisions, hypothesis changes, assigned actions, new evidence, change in confidence, next meeting." />
                <Submit pendingText="AI analizuje…">Summarize Growth Session</Submit>
              </form>
            </div>
          </Card>
        )}

        {current && (
          <Card>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
              <Fact label="Date">{fmtDateTime(current.created_at)}</Fact>
              <Fact label="Participants">{current.participants ?? "—"}</Fact>
              <Fact label="Constraint at that time">{current.constraint_snapshot || "Diagnosis"}</Fact>
              <Fact label="Growth Cycle">{current.cycle_snapshot}</Fact>
            </div>
            <h2 className="mt-4 border-t border-line pt-4 text-[16px] font-semibold tracking-tight">{current.title}</h2>
            <ol className="mt-4 space-y-4">
              {messages.map((m) => (
                <li key={m.id} className={cn("rounded-xl px-4 py-3", m.role === "user" ? "ml-auto max-w-[85%] bg-sunken" : "border border-line bg-white")}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                    <span className="font-medium text-ink-soft">{m.role === "user" ? (m.author ?? "User") : "Growth AI"}</span><time>{fmtDateTime(m.created_at)}</time>
                  </div>
                  {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : <p className="whitespace-pre-wrap text-[13.5px]">{m.content}</p>}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {canChat ? (
          <Card>
            <form action={sendChatMessage} className="space-y-2">
              {hiddenLine}{current && <input type="hidden" name="conversation_id" value={current.id} />}
              <label className="label" htmlFor="content">{current ? "Reply" : "Start a conversation"}</label>
              <textarea id="content" name="content" required rows={3} disabled={!ai} className="input" placeholder="Np. „Dlaczego w styczniu uznaliśmy Sales Conversion za constraint?”" />
              <div className="flex items-center gap-3">
                <Submit className="btn-primary" pendingText="AI odpowiada…">Send</Submit>
                <span className="text-xs text-muted">AI widzi dane linii (CURRENT DATA) i wcześniejsze rozmowy (HISTORICAL DATA).</span>
              </div>
            </form>
          </Card>
        ) : !current && <Empty>Wybierz rozmowę z historii.</Empty>}
      </div>
    </div>
  );
}
