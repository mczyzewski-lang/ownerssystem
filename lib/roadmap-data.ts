import { cache } from "react";
import { sql } from "./db";
import { computeAlignment, computeStageDebt, stageFromHeadcount, type ChecklistItem, type Stage } from "./roadmap";

export const getStages = cache(async (): Promise<Stage[]> => sql<Stage[]>`select * from roadmap_stages order by number`);

export type Assessment = {
  id: string; business_line_id: string; stage_number: number; assessed_on: string; source: "ai" | "manual";
  status: "proposed" | "accepted" | "rejected"; manual_override: boolean; confidence: number | null;
  reason: string; evidence: string; ai_assessment: AiStageAssessment | null; author_name: string | null; created_at: string;
};

export type AiStageAssessment = {
  current_stage: number;
  confidence: number;
  why: string[];
  previous_stage_requirements: { stage: number; status: string; note?: string }[];
  current_stage_constraint: string;
  graduate_by: string;
  most_relevant_actions: string[];
  next_stage: number | null;
  readiness_indicators: string[];
  structural_stage?: number | null;
  lowest_unresolved_stage?: number | null;
  observed_vs_expected?: string;
  missing_data?: string[];
};

export type Observed = { key: string; name: string; id: string } | null;

/** Roadmap state for a set of business lines (used by the line view, the holding dashboard and AI context). */
export async function getRoadmapStates(lines: { id: string; headcount: number | null }[]) {
  const stages = await getStages();
  const ids = lines.map((l) => l.id);
  if (!ids.length) return new Map<string, ReturnType<typeof buildState>>();
  const [current, items, mains] = await Promise.all([
    sql<{ business_line_id: string; stage_number: number }[]>`
      select distinct on (business_line_id) business_line_id, stage_number
      from stage_assessments where status = 'accepted' and business_line_id in ${sql(ids)}
      order by business_line_id, assessed_on desc, created_at desc`,
    sql<(ChecklistItem & { business_line_id: string })[]>`
      select b.id as business_line_id, i.id, i.stage_number, i.text,
             coalesce(r.status, 'not_reviewed') as status, coalesce(r.comment, '') as comment,
             coalesce(r.evidence, '') as evidence, coalesce(r.metric, '') as metric,
             r.owner_id, u.name as owner_name, r.updated_at
      from business_lines b
      cross join roadmap_checklist_items i
      left join roadmap_checklist_reviews r on r.item_id = i.id and r.business_line_id = b.id
      left join users u on u.id = r.owner_id
      where b.id in ${sql(ids)} and i.archived_at is null
      order by i.stage_number, i.position`,
    sql<{ business_line_id: string; id: string; key: string; name: string }[]>`
      select r.business_line_id, c.id, c.key, c.name from constraint_reviews r
      join constraints c on c.id = r.constraint_id
      where r.status = 'main' and r.business_line_id in ${sql(ids)}`,
  ]);
  const out = new Map<string, ReturnType<typeof buildState>>();
  for (const l of lines) {
    out.set(
      l.id,
      buildState(
        stages,
        current.find((c) => c.business_line_id === l.id)?.stage_number ?? null,
        l.headcount,
        items.filter((i) => i.business_line_id === l.id),
        mains.find((m) => m.business_line_id === l.id) ?? null,
      ),
    );
  }
  return out;
}

function buildState(stages: Stage[], currentNumber: number | null, headcount: number | null, items: ChecklistItem[], observed: Observed) {
  const current = stages.find((s) => s.number === currentNumber) ?? null;
  const headcountStage = stageFromHeadcount(headcount, stages);
  const debt = computeStageDebt({ currentStage: currentNumber, structuralStage: headcountStage, items, stages });
  const alignment = computeAlignment(observed, current);
  return { stages, current, headcountStage, items, observed, debt, alignment };
}

export type RoadmapState = ReturnType<typeof buildState>;

export async function getRoadmapState(line: { id: string; headcount: number | null }): Promise<RoadmapState> {
  return (await getRoadmapStates([line])).get(line.id)!;
}

export async function getStageHistory(lineId: string): Promise<Assessment[]> {
  return sql<Assessment[]>`
    select a.*, u.name as author_name from stage_assessments a left join users u on u.id = a.author_id
    where a.business_line_id = ${lineId} order by a.assessed_on desc, a.created_at desc`;
}
