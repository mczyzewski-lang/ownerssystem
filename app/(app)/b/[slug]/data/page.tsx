import { getLineAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listConstraints } from "@/lib/line-data";
import { addImport, saveBusinessDescription, saveMetric } from "@/lib/actions/data";
import { Submit } from "@/components/client";
import { Card, Empty, Field, Pill } from "@/components/ui";
import { fmtDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Data Room" };

const KINDS = ["raw_text", "table", "funnel_results", "business_description", "file"];

export default async function DataRoom({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { line, role } = await getLineAccess(slug);
  const [imports, metrics, constraints] = await Promise.all([
    sql`select d.*, u.name as author from data_imports d left join users u on u.id = d.created_by where d.business_line_id = ${line.id} order by d.created_at desc`,
    sql`select m.*, c.name as constraint_name from metrics m left join constraints c on c.id = m.constraint_id where m.business_line_id = ${line.id} order by m.created_at desc`,
    listConstraints(),
  ]);
  const canEdit = role !== "viewer";
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight">Data Room</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">Surowe dane, na których opiera się diagnoza. Oryginalny raw content nigdy nie jest modyfikowany ani kasowany. AI korzysta z tych danych jako kontekstu.</p>
      </div>

      <Card>
        <h3 className="h2 mb-2">Business description</h3>
        <form action={saveBusinessDescription} className="space-y-2">
          {hiddenLine}
          <textarea name="description" rows={5} defaultValue={line.description} disabled={!canEdit} className="input" placeholder="Opis biznesu ownera: co sprzedajemy, komu, jak wygląda proces, ceny, zespół, kanały…" />
          {canEdit && <Submit>Save description</Submit>}
        </form>
      </Card>

      {canEdit && (
        <Card>
          <h3 className="h2 mb-3">New import</h3>
          <form action={addImport} className="grid gap-3 sm:grid-cols-4">
            {hiddenLine}
            <Field label="Name" className="sm:col-span-2"><input name="name" className="input" placeholder="Np. Wyniki sprzedaży X.2026" /></Field>
            <Field label="Type"><select name="kind" className="input">{KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</select></Field>
            <Field label="Date"><input name="import_date" type="date" className="input" /></Field>
            <Field label="Source"><input name="source" className="input" placeholder="CRM, Google Ads, owner…" /></Field>
            <Field label="Description" className="sm:col-span-3"><input name="description" className="input" /></Field>
            <Field label="Paste raw text / table / funnel results" className="sm:col-span-4"><textarea name="raw_content" rows={6} className="input font-mono !text-[12px]" placeholder="Wklej tekst albo tabelę (np. skopiowaną z arkusza)…" /></Field>
            <Field label="…or upload TXT / CSV" className="sm:col-span-2"><input name="file" type="file" accept=".txt,.csv,.tsv,.md,text/plain,text/csv" className="input" /></Field>
            <div className="flex items-end"><Submit className="btn-primary" pendingText="Importing…">Import</Submit></div>
          </form>
        </Card>
      )}

      <section>
        <h3 className="h2 mb-3">Imports</h3>
        {imports.length === 0 ? <Empty>Brak importów.</Empty> : (
          <div className="card divide-y divide-line">
            {imports.map((d) => {
              const parsed = d.parsed_content as { columns: string[]; rows: string[][] } | null;
              return (
                <details key={d.id}>
                  <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-sunken/50">
                    <span className="text-[13.5px] font-medium">{d.name}</span>
                    <Pill>{titleCase(d.kind)}</Pill>
                    {parsed && <Pill tone="healthy">parsed · {parsed.rows.length} rows</Pill>}
                    <span className="ml-auto text-xs text-muted">{fmtDate(d.import_date)}{d.source && ` · ${d.source}`}{d.author && ` · ${d.author}`}</span>
                  </summary>
                  <div className="space-y-3 border-t border-line bg-sunken/30 px-4 py-3">
                    {d.description && <p className="text-[13px] text-ink-soft">{d.description}</p>}
                    {parsed && (
                      <div>
                        <div className="eyebrow mb-1">Parsed content</div>
                        <div className="max-h-72 overflow-auto rounded-lg border border-line bg-white">
                          <table className="tbl !text-[12px]"><thead><tr>{parsed.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                            <tbody>{parsed.rows.slice(0, 100).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="!py-1">{c}</td>)}</tr>)}</tbody></table>
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="eyebrow mb-1">Raw content (original){d.filename && ` · ${d.filename}`}</div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-3 text-[12px]">{d.raw_content}</pre>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="h2 mb-3">Metrics</h3>
        <Card className="overflow-x-auto !p-0">
          <table className="tbl min-w-[720px]">
            <thead><tr><th>Metric</th><th className="text-right">Value</th><th>Period</th><th>Constraint</th><th>Source</th><th>Note</th><th /></tr></thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td className="text-right tabular-nums">{m.value}{m.unit && ` ${m.unit}`}</td>
                  <td className="whitespace-nowrap text-xs">{m.period_start ? `${fmtDate(m.period_start)}–${fmtDate(m.period_end)}` : "—"}</td>
                  <td className="text-xs">{m.constraint_name ?? "—"}</td><td className="text-xs">{m.source || "—"}</td><td className="text-xs text-ink-soft">{m.note}</td>
                  <td>{canEdit && <form action={saveMetric}>{hiddenLine}<input type="hidden" name="id" value={m.id} /><Submit name="op" value="delete" className="btn-sm btn-ghost" confirm="Usunąć metrykę?">×</Submit></form>}</td>
                </tr>
              ))}
              {metrics.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">Brak ręcznie wpisanych metryk.</td></tr>}
            </tbody>
          </table>
        </Card>
        {canEdit && (
          <form action={saveMetric} className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_0.7fr_0.5fr_0.9fr_0.9fr_1.2fr_1fr_auto]">
            {hiddenLine}
            <input name="name" required placeholder="Metric (np. Show → Paid)" aria-label="Metric name" className="input" />
            <input name="value" required placeholder="Value" aria-label="Value" className="input" />
            <input name="unit" placeholder="Unit" aria-label="Unit" className="input" />
            <input name="period_start" type="date" aria-label="Period start" className="input" />
            <input name="period_end" type="date" aria-label="Period end" className="input" />
            <select name="constraint_id" aria-label="Constraint" className="input"><option value="">Constraint —</option>{constraints.map((c) => <option key={c.id} value={c.id}>{c.number}. {c.name}</option>)}</select>
            <input name="note" placeholder="Note / source" aria-label="Note" className="input" />
            <Submit>Add</Submit>
          </form>
        )}
      </section>
    </div>
  );
}
