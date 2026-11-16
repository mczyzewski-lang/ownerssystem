import Link from "next/link";
import { redirect } from "next/navigation";
import { getLineAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getConstraintMap, getCycles, type ConstraintRow } from "@/lib/line-data";
import { PrimaryConstraint } from "@/components/primary";
import { ConstraintStatusPill } from "@/components/ui";
import { cn, CONSTRAINT_STATUS, fmtDate } from "@/lib/utils";

const TONE: Record<string, string> = {
  main: "border-critical/50 bg-critical-soft/40",
  candidate: "border-watch/50",
  watch: "border-watch/30",
  healthy: "border-healthy/30",
  resolved: "bg-sunken/60",
};

function MapCard({ c, slug, wide }: { c: ConstraintRow; slug: string; wide?: boolean }) {
  const pct = c.total ? Math.round((c.reviewed / c.total) * 100) : 0;
  return (
    <Link href={`/b/${slug}/review?c=${c.key}`} className={cn("card group flex h-full flex-col p-4 transition-shadow hover:shadow-[0_1px_0_0_var(--color-line-strong),0_8px_24px_-12px_rgba(35,34,31,0.25)]", TONE[c.status], wide && "sm:flex-row sm:items-center sm:gap-6")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tabular-nums text-muted">{String(c.number).padStart(2, "0")}{c.cross_cutting && " · cross-cutting"}</span>
          {c.score != null && <span className="text-xs tabular-nums text-muted"><span className="text-[15px] font-semibold text-ink">{c.score}</span>/10</span>}
        </div>
        <div className="mt-1 text-[13.5px] font-semibold leading-snug tracking-tight">{c.name}</div>
        <div className="mt-2"><ConstraintStatusPill status={c.status} /></div>
      </div>
      <div className={cn("mt-4", wide && "sm:mt-0 sm:w-64")}>
        <div className="h-1 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-ink-soft/70" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
          <span>{c.reviewed}/{c.total} reviewed</span>
          {c.concerns > 0 && <span className="text-watch">{c.concerns} concern{c.concerns > 1 ? "s" : ""}</span>}
          {c.candidates > 0 && <span className="text-watch">{c.candidates} candidate</span>}
          {c.comments > 0 && <span>{c.comments} comment{c.comments > 1 ? "s" : ""}</span>}
        </div>
      </div>
    </Link>
  );
}

export default async function LineOverview({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ full?: string }> }) {
  const { slug } = await params;
  const { full } = await searchParams;
  const { line, role } = await getLineAccess(slug);
  // Owners land on the simple Owner Workspace; the full diagnostic view is one click away.
  if (role !== "growth_architect" && !full) redirect(`/b/${line.slug}/workspace`);
  const [map, cycles, history] = await Promise.all([
    getConstraintMap(line.id),
    getCycles(line.id),
    sql`select h.id, h.changed_at, h.from_status, h.to_status, h.reason, c.name, u.name as by_name
        from constraint_status_history h join constraints c on c.id = h.constraint_id left join users u on u.id = h.changed_by
        where h.business_line_id = ${line.id} order by h.changed_at desc limit 30`,
  ]);
  const main = map.find((c) => c.status === "main");
  const active = cycles.find((c) => c.status === "active");
  const chain = map.filter((c) => !c.cross_cutting);
  const cross = map.filter((c) => c.cross_cutting);

  return (
    <div className="space-y-8">
      <PrimaryConstraint slug={line.slug} main={main} cycle={active} />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="h2">Constraint Map</h2>
            <p className="text-[13px] text-muted">Od rynku do LTV — gdzie przepływ wartości jest najbardziej ograniczony? Kliknij obszar, aby wejść w Review.</p>
          </div>
          <Link href={`/b/${line.slug}/review`} className="btn">Open Review Mode</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chain.map((c, i) => (
            <div key={c.id} className="relative">
              <MapCard c={c} slug={line.slug} />
              {i < chain.length - 1 && <span aria-hidden className={cn("pointer-events-none absolute -right-[11px] top-1/2 z-10 hidden -translate-y-1/2 text-line-strong lg:block", (i + 1) % 4 === 0 && "lg:hidden")}>→</span>}
            </div>
          ))}
        </div>
        {cross.map((c) => <div key={c.id} className="mt-3"><MapCard c={c} slug={line.slug} wide /></div>)}
      </section>

      <section>
        <h2 className="h2 mb-3">Constraint history</h2>
        {history.length === 0 ? <p className="text-[13px] text-muted">Brak zmian statusów.</p> : (
          <ol className="card divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <time className="w-20 tabular-nums text-muted">{fmtDate(h.changed_at)}</time>
                <span className="font-medium">{h.name}</span>
                <span className="text-muted">{CONSTRAINT_STATUS[h.from_status]?.label ?? "—"} →</span>
                <ConstraintStatusPill status={h.to_status} />
                {h.reason && <span className="text-ink-soft">{h.reason}</span>}
                <span className="ml-auto text-xs text-muted">{h.by_name}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
