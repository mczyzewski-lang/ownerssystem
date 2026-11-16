import Link from "next/link";
import type { ConstraintRow, Cycle } from "@/lib/line-data";
import { Fact, Pill } from "./ui";
import { fmtDate, titleCase } from "@/lib/utils";

/** "Current Primary Constraint" header — the single strategic priority of a business line. */
export function PrimaryConstraint({ slug, main, cycle, compact }: { slug: string; main: ConstraintRow | undefined; cycle: Cycle | undefined; compact?: boolean }) {
  if (!main) {
    return (
      <section className="card p-6">
        <div className="eyebrow">Current Primary Constraint</div>
        <div className="mt-2 text-[22px] font-semibold tracking-tight text-muted">Diagnosis in progress</div>
        <p className="mt-1 max-w-xl text-[13px] text-muted">Ta linia nie ma jeszcze MAIN CONSTRAINT. Przejdź przez Constraint Map, oznacz kandydatów i wybierz jeden główny constraint.</p>
      </section>
    );
  }
  return (
    <section className="card overflow-hidden">
      <div className="border-l-[3px] border-critical p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Current Primary Constraint</div>
            <div className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight">{main.name}</div>
          </div>
          {cycle ? <Pill tone="ink">{titleCase(cycle.status).toUpperCase()}</Pill> : <Pill tone="watch">No active Growth Cycle</Pill>}
        </div>
        {cycle ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Fact label="Metric">{cycle.primary_metric}</Fact>
              <Fact label="Baseline"><span className="text-[18px] font-semibold tabular-nums">{cycle.baseline}</span></Fact>
              <Fact label="Target"><span className="text-[18px] font-semibold tabular-nums">{cycle.target}</span></Fact>
              <Fact label="Owner">{cycle.owner_name}</Fact>
              <Fact label="Growth Cycle">{cycle.start_date ? `${fmtDate(cycle.start_date)}–${fmtDate(cycle.end_date)}` : cycle.name}</Fact>
              <Fact label="Economic upside">{cycle.economic_upside}</Fact>
              <Fact label="Confidence">{titleCase(cycle.confidence)}</Fact>
              <Fact label="Condition of Victory">{cycle.condition_of_victory}</Fact>
            </div>
            {!compact && cycle.root_causes && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="eyebrow">Root causes</div>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-ink-soft">{cycle.root_causes}</p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-[13px] text-muted">Constraint jest ustawiony, ale nie ma aktywnego Growth Cycle. <Link href={`/b/${slug}/cycles`} className="underline underline-offset-2">Otwórz Growth Cycle</Link>, aby ustalić metrykę, baseline, target i Condition of Victory.</p>
        )}
      </div>
    </section>
  );
}
