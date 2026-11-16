import Link from "next/link";
import { sql } from "@/lib/db";
import { saveDecision } from "@/lib/actions/data";
import { Submit } from "./client";
import { Card, Empty, Field, UserSelect } from "./ui";
import { fmtDate } from "@/lib/utils";

type D = { id?: string; decision_date?: string; decision?: string; why?: string; evidence?: string; owner_id?: string | null; expected_result?: string; review_date?: string | null; result?: string };

function DecisionForm({ slug, d = {}, users }: { slug: string; d?: D; users: { id: string; name: string }[] }) {
  return (
    <form action={saveDecision} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="line" value={slug} />{d.id && <input type="hidden" name="id" value={d.id} />}
      <Field label="Date"><input name="decision_date" type="date" defaultValue={d.decision_date} className="input" /></Field>
      <Field label="Owner"><UserSelect name="owner_id" users={users} value={d.owner_id} /></Field>
      <Field label="Review date"><input name="review_date" type="date" defaultValue={d.review_date ?? ""} className="input" /></Field>
      <div />
      <Field label="Decision" className="sm:col-span-4"><textarea name="decision" required rows={2} defaultValue={d.decision} className="input" placeholder="„Nie skalujemy Lead Gen. Najpierw pracujemy nad Show → Paid.”" /></Field>
      <Field label="Why" className="sm:col-span-2"><textarea name="why" rows={2} defaultValue={d.why} className="input" /></Field>
      <Field label="Evidence" className="sm:col-span-2"><textarea name="evidence" rows={2} defaultValue={d.evidence} className="input" /></Field>
      <Field label="Expected result" className="sm:col-span-2"><textarea name="expected_result" rows={2} defaultValue={d.expected_result} className="input" /></Field>
      <Field label="Result" className="sm:col-span-2"><textarea name="result" rows={2} defaultValue={d.result} className="input" /></Field>
      <div><Submit className="btn-primary">{d.id ? "Save" : "Log decision"}</Submit></div>
    </form>
  );
}

/** Decision log for one business line (editable by its Growth Architect) or for the whole holding (read-only). */
export async function DecisionLog({ lineIds, editable, users }: { lineIds: string[]; editable?: { slug: string }; users: { id: string; name: string }[] }) {
  const rows = lineIds.length
    ? await sql`select d.*, b.name as business, b.slug, u.name as owner from decisions d join business_lines b on b.id = d.business_line_id
                left join users u on u.id = d.owner_id where d.business_line_id in ${sql(lineIds)} order by d.decision_date desc, d.created_at desc`
    : [];
  return (
    <div className="space-y-4">
      {editable && (
        <details>
          <summary className="btn w-fit">+ Log decision</summary>
          <Card className="mt-3"><DecisionForm slug={editable.slug} users={users} /></Card>
        </details>
      )}
      {rows.length === 0 ? <Empty>Brak zapisanych decyzji.</Empty> : (
        <div className="card divide-y divide-line">
          {rows.map((d) => (
            <details key={d.id}>
              <summary className="grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-sunken/50 sm:grid-cols-[84px_150px_1fr_110px]">
                <time className="text-[13px] tabular-nums text-muted">{fmtDate(d.decision_date)}</time>
                <span className="truncate text-[13px] text-ink-soft">{editable ? (d.owner ?? "—") : <Link href={`/b/${d.slug}/decisions`} className="hover:underline">{d.business}</Link>}</span>
                <span className="text-[13.5px] font-medium">{d.decision}</span>
                <span className="text-xs text-muted sm:text-right">{d.result ? "Result recorded" : d.review_date ? `Review ${fmtDate(d.review_date)}` : ""}</span>
              </summary>
              <div className="border-t border-line bg-sunken/30 px-4 py-4">
                {editable ? <DecisionForm slug={editable.slug} d={d as D} users={users} /> : (
                  <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                    {[["Why", d.why], ["Evidence", d.evidence], ["Owner", d.owner], ["Expected result", d.expected_result], ["Review date", fmtDate(d.review_date)], ["Result", d.result]].map(([k, v]) => (
                      <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 whitespace-pre-wrap">{v || "—"}</dd></div>
                    ))}
                  </dl>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
