import Link from "next/link";
import type { ReactNode } from "react";
import type { Alignment, Stage, StageDebt } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { Pill } from "./ui";

export function AlignmentPill({ alignment, short }: { alignment: Alignment; short?: boolean }) {
  const tone = alignment.level === "VERY HIGH" ? "healthy" : alignment.level === "MEDIUM" ? "watch" : alignment.level === "LOW" ? "critical" : "neutral";
  return <Pill tone={tone}>{short ? alignment.short : alignment.verdict}</Pill>;
}

export function DebtPill({ debt }: { debt: StageDebt }) {
  if (!debt.level) return <Pill>—</Pill>;
  return <Pill tone={debt.level === "HIGH" ? "critical" : debt.level === "MEDIUM" ? "watch" : "healthy"}>{debt.level}</Pill>;
}

/** The 10 stages on one horizontal axis: graduated (green) → current (highlighted) → next (grey). */
export function StageAxis({ stages, current, selected, headcountStage, lowestUnresolved, href }: {
  stages: Stage[]; current: number | null; selected: number; headcountStage: number | null; lowestUnresolved: number | null; href: (n: number) => string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-[880px] items-stretch">
        {stages.map((s, i) => {
          const state = current == null ? "next" : s.number < current ? "done" : s.number === current ? "current" : "next";
          const markers: ReactNode[] = [];
          if (headcountStage === s.number && headcountStage !== current) markers.push(<span key="h" className="text-muted">org size</span>);
          if (lowestUnresolved != null && lowestUnresolved === s.number && current != null && lowestUnresolved < current) markers.push(<span key="d" className="font-medium text-critical">stage debt</span>);
          return (
            <li key={s.number} className="flex flex-1 items-start">
              <Link href={href(s.number)} scroll={false} aria-current={state === "current" ? "step" : undefined}
                className={cn("group flex w-full flex-col items-center rounded-lg px-1 py-2 text-center", selected === s.number && "bg-sunken")}>
                <span className={cn("grid h-8 w-8 place-items-center rounded-full border text-[13px] font-semibold",
                  state === "done" && "border-healthy/40 bg-healthy-soft text-healthy",
                  state === "current" && "border-ink bg-ink text-paper ring-4 ring-ink/10",
                  state === "next" && "border-line-strong bg-surface text-muted")}>
                  {state === "done" ? "✓" : s.number}
                </span>
                <span className={cn("mt-1.5 text-[11px] font-semibold tracking-[0.04em]",
                  state === "done" && "text-healthy", state === "current" && "text-ink", state === "next" && "text-muted")}>{s.name}</span>
                <span className="text-[10.5px] text-muted">{s.headcount_label}</span>
                <span className="mt-0.5 flex min-h-[14px] flex-col text-[10px] leading-tight">{markers}</span>
              </Link>
              {i < stages.length - 1 && <span aria-hidden className={cn("mt-6 h-px w-3 shrink-0", current != null && s.number < current ? "bg-healthy/50" : "bg-line-strong")} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
