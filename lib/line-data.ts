import { cache } from "react";
import { sql } from "./db";

export type ConstraintRow = {
  id: string; key: string; number: number; name: string; description: string; cross_cutting: boolean;
  status: string; score: number | null; evidence: string; data_notes: string; owner_id: string | null; owner_name: string | null;
  last_reviewed_at: string | null; total: number; reviewed: number; concerns: number; candidates: number; comments: number;
};

export const getConstraintMap = cache(async (lineId: string): Promise<ConstraintRow[]> => sql<ConstraintRow[]>`
  select c.id, c.key, c.number, c.name, c.description, c.cross_cutting,
         coalesce(r.status, 'not_reviewed') as status, r.score, coalesce(r.evidence, '') as evidence,
         coalesce(r.data_notes, '') as data_notes, r.owner_id, u.name as owner_name, r.last_reviewed_at,
         s.total, s.reviewed, s.concerns, s.candidates,
         (select count(*)::int from comments cm where cm.business_line_id = ${lineId}
            and ((cm.target_type = 'constraint' and cm.target_id = c.id)
              or (cm.target_type = 'node' and cm.target_id in (select id from checklist_nodes where constraint_id = c.id)))) as comments
  from constraints c
  left join constraint_reviews r on r.constraint_id = c.id and r.business_line_id = ${lineId}
  left join users u on u.id = r.owner_id
  cross join lateral (
    select count(*) filter (where n.kind = 'item')::int as total,
           count(*) filter (where n.kind = 'item' and cr.status is not null and cr.status <> 'not_reviewed')::int as reviewed,
           count(*) filter (where cr.status = 'concern')::int as concerns,
           count(*) filter (where cr.status = 'candidate')::int as candidates
    from checklist_nodes n
    left join checklist_reviews cr on cr.node_id = n.id and cr.business_line_id = ${lineId}
    where n.constraint_id = c.id and n.archived_at is null) s
  order by c.number`);

export type Cycle = {
  id: string; name: string; start_date: string | null; end_date: string | null; constraint_id: string | null; constraint_name: string | null;
  primary_metric: string; baseline: string; target: string; economic_upside: string; confidence: string; owner_id: string | null;
  owner_name: string | null; root_causes: string; condition_of_victory: string; status: string; result: string; retrospective: string;
};

export const getCycles = cache(async (lineId: string): Promise<Cycle[]> => sql<Cycle[]>`
  select g.*, c.name as constraint_name, u.name as owner_name from growth_cycles g
  left join constraints c on c.id = g.constraint_id left join users u on u.id = g.owner_id
  where g.business_line_id = ${lineId}
  order by (g.status = 'active') desc, (g.status = 'planned') desc, g.start_date desc nulls last, g.created_at desc`);

export const listConstraints = cache(async () => sql<{ id: string; key: string; number: number; name: string }[]>`
  select id, key, number, name from constraints order by number`);
