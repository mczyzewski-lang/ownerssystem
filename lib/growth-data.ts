import { cache } from "react";
import { sql } from "./db";

/** Sections & subsections as "subcategory" options for hypotheses. */
export const getSectionOptions = cache(async () => sql<{ id: string; label: string }[]>`
  select n.id, c.number || '. ' || coalesce(p.title || ' → ', '') || n.title as label
  from checklist_nodes n join constraints c on c.id = n.constraint_id left join checklist_nodes p on p.id = n.parent_id
  where n.kind in ('section', 'subsection') and n.archived_at is null
  order by c.number, coalesce(p.position, n.position), (p.id is not null), n.position`);

export type HypothesisRow = {
  id: string; statement: string; constraint_id: string | null; constraint_name: string | null; node_id: string | null; node_title: string | null;
  cycle_id: string | null; expected_impact: string; impact: number; confidence: number; effort: number; speed: number; time_to_learn: string;
  economic_upside: string; owner_id: string | null; owner_name: string | null; status: string; result: string; created_at: string;
  experiments: number; running: number;
};

export const getHypotheses = cache(async (lineId: string) => sql<HypothesisRow[]>`
  select h.*, c.name as constraint_name, n.title as node_title, u.name as owner_name,
         (select count(*)::int from experiments e where e.hypothesis_id = h.id) as experiments,
         (select count(*)::int from experiments e where e.hypothesis_id = h.id and e.status = 'running') as running
  from hypotheses h left join constraints c on c.id = h.constraint_id
  left join checklist_nodes n on n.id = h.node_id left join users u on u.id = h.owner_id
  where h.business_line_id = ${lineId} order by h.created_at desc`);
