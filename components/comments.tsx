import { sql } from "@/lib/db";
import { addComment, editComment, setCommentStatus } from "@/lib/actions/comments";
import { Submit } from "./client";
import { Pill } from "./ui";
import { cn, fmtDateTime } from "@/lib/utils";
import type { Role } from "@/lib/utils";

type Row = {
  id: string; parent_id: string | null; kind: string; author_id: string | null; author: string | null; body: string;
  status: string; created_at: string; edited_at: string | null; edits: { body: string; edited_at: string }[] | null;
};

const KIND: Record<string, string> = { question: "Question", data_request: "Data request" };

function Body({ text }: { text: string }) {
  // highlight @mentions
  const parts = text.split(/(@[\p{L}\p{N}_-]+(?: [\p{Lu}][\p{L}]+)?)/u);
  return <p className="whitespace-pre-wrap text-[13.5px] text-ink">{parts.map((p, i) => (p.startsWith("@") ? <span key={i} className="font-medium underline decoration-line-strong underline-offset-2">{p}</span> : p))}</p>;
}

/** Comment thread for any target: constraint, section, subsection, atomic item, hypothesis, cycle… */
export async function Comments({ line, targetType, targetId, user, role, title = "Comments" }: {
  line: { id: string; slug: string }; targetType: string; targetId: string; user: { id: string }; role: Role; title?: string;
}) {
  const rows = await sql<Row[]>`
    select c.id, c.parent_id, c.kind, c.author_id, u.name as author, c.body, c.status, c.created_at, c.edited_at,
           (select json_agg(json_build_object('body', e.body, 'edited_at', e.edited_at) order by e.edited_at desc)
              from comment_edits e where e.comment_id = c.id) as edits
    from comments c left join users u on u.id = c.author_id
    where c.business_line_id = ${line.id} and c.target_type = ${targetType} and c.target_id = ${targetId}
    order by c.created_at`;
  const can = role !== "viewer";
  const hidden = (
    <>
      <input type="hidden" name="line" value={line.slug} />
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
    </>
  );
  const render = (c: Row, depth: number) => (
    <li key={c.id} className={cn(depth > 0 && "ml-5 border-l border-line pl-4")}>
      <div className={cn("py-2.5", c.status === "resolved" && "opacity-60")}>
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="font-medium text-ink">{c.author ?? "Unknown"}</span>
          <time>{fmtDateTime(c.created_at)}</time>
          {c.kind !== "comment" && <Pill tone="watch">{KIND[c.kind]}</Pill>}
          {c.status === "resolved" && <Pill tone="resolved">Resolved</Pill>}
          {c.edited_at && (
            <details className="inline">
              <summary className="inline underline underline-offset-2">edited · history</summary>
              <ul className="mt-1 space-y-1 rounded-md bg-sunken p-2">
                {(c.edits ?? []).map((e, i) => <li key={i}><span className="text-muted">{fmtDateTime(e.edited_at)}:</span> <span className="whitespace-pre-wrap text-ink-soft">{e.body}</span></li>)}
              </ul>
            </details>
          )}
        </div>
        <Body text={c.body} />
        {can && (
          <div className="mt-1.5 flex flex-wrap items-start gap-3 text-xs text-muted">
            <details>
              <summary className="underline underline-offset-2">Reply</summary>
              <form action={addComment} className="mt-2 w-72 max-w-full space-y-2">
                {hidden}<input type="hidden" name="parent_id" value={c.id} />
                <textarea name="body" required rows={2} className="input" placeholder="Reply… use @Name to mention" />
                <Submit className="btn-sm">Reply</Submit>
              </form>
            </details>
            {c.author_id === user.id && (
              <details>
                <summary className="underline underline-offset-2">Edit</summary>
                <form action={editComment} className="mt-2 w-72 max-w-full space-y-2">
                  <input type="hidden" name="line" value={line.slug} /><input type="hidden" name="id" value={c.id} />
                  <textarea name="body" required rows={3} defaultValue={c.body} className="input" />
                  <Submit className="btn-sm">Save edit</Submit>
                </form>
              </details>
            )}
            <form action={setCommentStatus}>
              <input type="hidden" name="line" value={line.slug} /><input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="status" value={c.status === "resolved" ? "open" : "resolved"} />
              <button className="underline underline-offset-2">{c.status === "resolved" ? "Reopen" : "Resolve"}</button>
            </form>
          </div>
        )}
      </div>
      {rows.filter((r) => r.parent_id === c.id).length > 0 && <ul>{rows.filter((r) => r.parent_id === c.id).map((r) => render(r, depth + 1))}</ul>}
    </li>
  );
  return (
    <div>
      <h3 className="eyebrow mb-1">{title} {rows.length > 0 && <span className="text-ink">· {rows.length}</span>}</h3>
      {rows.length > 0 && <ul className="divide-y divide-line">{rows.filter((r) => !r.parent_id).map((r) => render(r, 0))}</ul>}
      {can ? (
        <form action={addComment} className="mt-2 space-y-2">
          {hidden}
          <textarea name="body" required rows={2} className="input" placeholder="Add a comment… use @Name to mention" />
          <div className="flex items-center gap-2">
            <Submit className="btn-sm">Comment</Submit>
            {role === "growth_architect" && (
              <select name="kind" aria-label="Comment type" className="input !w-auto !py-1 text-xs">
                <option value="comment">Comment</option>
                <option value="question">Question to owner</option>
                <option value="data_request">Data request</option>
              </select>
            )}
          </div>
        </form>
      ) : rows.length === 0 ? <p className="text-[13px] text-muted">No comments.</p> : null}
    </div>
  );
}
