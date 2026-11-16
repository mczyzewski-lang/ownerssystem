import Link from "next/link";
import { getLineAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteFunnelDataset, saveFunnelData, saveFunnelStep } from "@/lib/actions/data";
import { Submit } from "@/components/client";
import { Card, Empty, Field, Pill } from "@/components/ui";
import { cn, fmtDate } from "@/lib/utils";

export const metadata = { title: "Funnel" };

const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);

export default async function FunnelPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ d?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { line, role } = await getLineAccess(slug);
  const steps = await sql<{ id: string; name: string; position: number }[]>`
    select s.id, s.name, s.position from funnel_steps s join funnel_definitions f on f.id = s.funnel_id
    where f.business_line_id = ${line.id} order by s.position, s.name`;
  const data = await sql<{ step_id: string; period_start: string; period_end: string; segment: string; source: string; volume: string; revenue: string | null }[]>`
    select d.step_id, d.period_start, d.period_end, d.segment, d.source, d.volume, d.revenue
    from funnel_data d join funnel_definitions f on f.id = d.funnel_id where f.business_line_id = ${line.id}
    order by d.period_end desc, d.period_start desc, d.segment, d.source`;
  const ga = role === "growth_architect";
  const canEdit = role !== "viewer";

  type Dataset = { key: string; period_start: string; period_end: string; segment: string; source: string; values: Map<string, { volume: number; revenue: number | null }> };
  const datasets: Dataset[] = [];
  for (const r of data) {
    const key = [r.period_start, r.period_end, r.segment, r.source].join("|");
    let ds = datasets.find((d) => d.key === key);
    if (!ds) datasets.push((ds = { key, period_start: r.period_start, period_end: r.period_end, segment: r.segment, source: r.source, values: new Map() }));
    ds.values.set(r.step_id, { volume: Number(r.volume), revenue: r.revenue == null ? null : Number(r.revenue) });
  }
  const selected = datasets[Math.min(Math.max(Number(sp.d) || 0, 0), Math.max(datasets.length - 1, 0))];
  const label = (d: Dataset) => `${fmtDate(d.period_start)}–${fmtDate(d.period_end)}${d.segment ? ` · ${d.segment}` : ""}${d.source ? ` · ${d.source}` : ""}`;
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;

  // step-to-step conversion for the selected dataset; the biggest loss is highlighted
  const rows = selected
    ? steps.filter((s) => selected.values.has(s.id)).map((s) => ({ ...s, ...selected.values.get(s.id)! }))
    : [];
  const conv = rows.map((r, i) => (i === 0 ? null : pct(r.volume, rows[i - 1].volume)));
  const worst = conv.reduce<number | null>((w, c, i) => (c != null && (w == null || c < conv[w]!) ? i : w), null);
  const top = Math.max(...rows.map((r) => r.volume), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight">Funnel</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">Edytowalny per linia. Dane per okres, segment i źródło — największa strata jest zaznaczona.</p>
      </div>

      {datasets.length === 0 ? <Empty>Brak danych funnelu. Dodaj pierwszy okres poniżej albo wklej wyniki w Data Room.</Empty> : (
        <Card>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {datasets.map((d, i) => <Link key={d.key} href={`?d=${i}`} scroll={false} className={cn("pill", d === selected && "pill-ink")}>{label(d)}</Link>)}
          </div>
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li key={r.id}>
                {i > 0 && (
                  <div className={cn("flex items-center gap-2 py-1 pl-[9.5rem] text-xs", worst === i ? "font-medium text-critical" : "text-muted")}>
                    <span aria-hidden>↓</span>
                    <span className="tabular-nums">{conv[i] == null ? "—" : `${nf.format(conv[i]!)}%`}</span>
                    <span>· lost {nf.format(Math.max(rows[i - 1].volume - r.volume, 0))}</span>
                    {worst === i && <Pill tone="critical">Biggest leak</Pill>}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-[13px] font-medium">{r.name}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-md bg-sunken">
                    <div className={cn("h-full rounded-md", worst === i ? "bg-critical/70" : "bg-ink-soft/75")} style={{ width: `${Math.max((r.volume / top) * 100, 0.5)}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums">{nf.format(r.volume)}</span>
                  <span className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-muted sm:block">{r.revenue != null ? `${nf.format(r.revenue)} PLN` : ""}</span>
                </div>
              </li>
            ))}
          </ol>
          {rows.length > 1 && <p className="mt-4 text-xs text-muted">End-to-end: {nf.format(pct(rows.at(-1)!.volume, rows[0].volume) ?? 0)}% ({rows[0].name} → {rows.at(-1)!.name})</p>}
          {ga && selected && (
            <form action={deleteFunnelDataset} className="mt-3">
              {hiddenLine}{(["period_start", "period_end", "segment", "source"] as const).map((k) => <input key={k} type="hidden" name={k} value={selected[k]} />)}
              <Submit className="btn-sm btn-ghost" confirm="Usunąć ten zestaw danych funnelu?">Delete this dataset</Submit>
            </form>
          )}
        </Card>
      )}

      {datasets.length > 1 && (
        <Card className="overflow-x-auto !p-0">
          <div className="px-5 pb-1 pt-4"><h3 className="h2">Compare periods / segments / sources</h3></div>
          <table className="tbl min-w-[760px]">
            <thead><tr><th>Dataset</th>{steps.map((s) => <th key={s.id} className="text-right">{s.name}</th>)}<th className="text-right">End-to-end</th></tr></thead>
            <tbody>
              {datasets.map((d) => {
                const present = steps.filter((s) => d.values.has(s.id));
                const e2e = present.length > 1 ? pct(d.values.get(present.at(-1)!.id)!.volume, d.values.get(present[0].id)!.volume) : null;
                return (
                  <tr key={d.key}>
                    <td className="whitespace-nowrap">{label(d)}</td>
                    {steps.map((s, i) => {
                      const v = d.values.get(s.id);
                      const prev = steps.slice(0, i).reverse().map((p) => d.values.get(p.id)).find(Boolean);
                      const c = v && prev ? pct(v.volume, prev.volume) : null;
                      return <td key={s.id} className="text-right tabular-nums">{v ? nf.format(v.volume) : "—"}{c != null && <div className="text-[11px] text-muted">{nf.format(c)}%</div>}</td>;
                    })}
                    <td className="text-right font-semibold tabular-nums">{e2e == null ? "—" : `${nf.format(e2e)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {canEdit && steps.length > 0 && (
        <Card>
          <h3 className="h2 mb-3">Add / update funnel data</h3>
          <form action={saveFunnelData} className="space-y-4">
            {hiddenLine}
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="From"><input type="date" name="period_start" required className="input" /></Field>
              <Field label="To"><input type="date" name="period_end" required className="input" /></Field>
              <Field label="Segment (optional)"><input name="segment" className="input" placeholder="np. ICP A" /></Field>
              <Field label="Source (optional)"><input name="source" className="input" placeholder="np. Google Search" /></Field>
            </div>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((s) => (
                <div key={s.id} className="grid grid-cols-[1fr_88px_104px] items-center gap-2">
                  <span className="truncate text-[13px]">{s.name}</span>
                  <input name={`volume_${s.id}`} inputMode="decimal" aria-label={`${s.name} volume`} placeholder="volume" className="input" />
                  <input name={`revenue_${s.id}`} inputMode="decimal" aria-label={`${s.name} revenue`} placeholder="revenue" className="input" />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">Ten sam okres + segment + source nadpisuje wcześniejsze wartości. Puste pola są pomijane.</p>
            <Submit className="btn-primary">Save funnel data</Submit>
          </form>
        </Card>
      )}

      {ga && (
        <Card>
          <h3 className="h2 mb-3">Funnel Builder — steps</h3>
          <ol className="divide-y divide-line">
            {steps.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="w-6 text-xs tabular-nums text-muted">{i + 1}</span>
                <form action={saveFunnelStep} className="flex flex-1 items-center gap-2">
                  {hiddenLine}<input type="hidden" name="id" value={s.id} />
                  <input name="name" defaultValue={s.name} aria-label="Step name" className="input max-w-xs" />
                  <button name="op" value="rename" className="btn btn-sm">Rename</button>
                  <button name="op" value="up" disabled={i === 0} className="btn btn-sm" aria-label="Move up">↑</button>
                  <button name="op" value="down" disabled={i === steps.length - 1} className="btn btn-sm" aria-label="Move down">↓</button>
                  <Submit name="op" value="delete" className="btn-sm btn-ghost" confirm={`Usunąć krok „${s.name}” razem z jego danymi?`}>Delete</Submit>
                </form>
              </li>
            ))}
          </ol>
          <form action={saveFunnelStep} className="mt-3 flex gap-2">{hiddenLine}<input name="name" required placeholder="New step" aria-label="New step" className="input max-w-xs" /><Submit className="btn-sm">Add step</Submit></form>
        </Card>
      )}
    </div>
  );
}
