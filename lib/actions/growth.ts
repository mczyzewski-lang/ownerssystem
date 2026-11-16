"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "../db";
import { back, fail, int, lineCtx, opt, str, uuid } from "../action-utils";
import { ACTIVE_HYPOTHESIS_STATUSES, HYPOTHESIS_STATUSES, MAX_ACTIVE } from "../utils";

const clamp = (n: number | null) => Math.min(10, Math.max(1, n ?? 5));

async function mainConstraint(lineId: string) {
  const [m] = await sql<{ id: string; name: string }[]>`
    select c.id, c.name from constraint_reviews r join constraints c on c.id = r.constraint_id
    where r.business_line_id = ${lineId} and r.status = 'main'`;
  return m ?? null;
}
async function activeCycle(lineId: string) {
  const [c] = await sql<{ id: string; name: string }[]>`select id, name from growth_cycles where business_line_id = ${lineId} and status = 'active'`;
  return c ?? null;
}

// ───────────── Growth Cycles

export async function saveCycle(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const id = uuid(fd, "id");
  const name = str(fd, "name");
  if (!name) return fail("Podaj nazwę Growth Cycle.");
  const confidence = ["high", "medium", "low"].includes(str(fd, "confidence")) ? str(fd, "confidence") : "medium";
  const data = {
    name, start_date: opt(fd, "start_date"), end_date: opt(fd, "end_date"), constraint_id: uuid(fd, "constraint_id"),
    primary_metric: str(fd, "primary_metric"), baseline: str(fd, "baseline"), target: str(fd, "target"),
    economic_upside: str(fd, "economic_upside"), confidence, owner_id: uuid(fd, "owner_id"),
    root_causes: str(fd, "root_causes"), condition_of_victory: str(fd, "condition_of_victory"),
    result: str(fd, "result"), retrospective: str(fd, "retrospective"),
  };
  if (id) await sql`update growth_cycles set ${sql(data)} where id = ${id} and business_line_id = ${line.id}`;
  else await sql`insert into growth_cycles ${sql({ ...data, business_line_id: line.id, status: "planned" })}`;
  return back({ notice: id ? "Zapisano Growth Cycle." : "Utworzono Growth Cycle jako PLANNED. Aktywuj go, gdy ma stać się jedynym priorytetem linii." });
}

export async function setCycleStatus(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const id = uuid(fd, "id");
  const status = str(fd, "status");
  if (!id || !["planned", "active", "completed", "abandoned"].includes(status)) return fail("Nieprawidłowy status.");
  const [cycle] = await sql`select id, constraint_id, result from growth_cycles where id = ${id} and business_line_id = ${line.id}`;
  if (!cycle) return fail("Nie znaleziono cyklu.");
  if (status === "active") {
    const active = await activeCycle(line.id);
    if (active && active.id !== id)
      return fail(`Ta linia ma już aktywny Primary Constraint w cyklu „${active.name}”. Nie otwieramy drugiego strategicznego priorytetu — najpierw zakończ (Complete / Abandon) aktywny Growth Cycle.`);
    const main = await mainConstraint(line.id);
    if (!main) return fail("Najpierw ustaw MAIN CONSTRAINT linii — Growth Cycle pracuje nad jednym, głównym constraintem.");
    if (cycle.constraint_id !== main.id)
      return fail(`Primary Constraint cyklu musi być MAIN CONSTRAINT linii (${main.name}). Zmień constraint cyklu albo MAIN CONSTRAINT.`);
  }
  if (status === "completed" && !str(fd, "result") && !cycle.result) return fail("Zamykając cykl, wpisz wynik (Result).");
  await sql`update growth_cycles set status = ${status},
              result = case when ${str(fd, "result")} <> '' then ${str(fd, "result")} else result end,
              retrospective = case when ${str(fd, "retrospective")} <> '' then ${str(fd, "retrospective")} else retrospective end
            where id = ${id}`;
  return back({
    notice: status === "completed"
      ? "Cykl zakończony. Zdecyduj teraz, co z MAIN CONSTRAINT: Resolved czy kolejny cykl?"
      : status === "active" ? "Growth Cycle aktywny." : "Zmieniono status cyklu.",
  });
}

// ───────────── Hypotheses

/** Max 3 active hypotheses, and only about the MAIN CONSTRAINT — one constraint → its hypotheses → experiments. */
async function guardActivation(lineId: string, hypothesisId: string | null, constraintId: string | null): Promise<string | null> {
  const main = await mainConstraint(lineId);
  if (!main) return "Najpierw ustaw MAIN CONSTRAINT. Aktywne (Prioritized / Testing) mogą być tylko hipotezy dotyczące głównego constraintu.";
  if (constraintId !== main.id)
    return `Aktywne mogą być tylko hipotezy dotyczące MAIN CONSTRAINT (${main.name}). Zostaw tę hipotezę w Backlogu albo zmień jej constraint.`;
  const [{ n }] = await sql`
    select count(*)::int as n from hypotheses where business_line_id = ${lineId}
      and status in ${sql(ACTIVE_HYPOTHESIS_STATUSES)} and id is distinct from ${hypothesisId}`;
  if (n >= MAX_ACTIVE) return `Maksymalnie ${MAX_ACTIVE} aktywne hipotezy naraz. Zamknij lub cofnij do Backlogu jedną z aktywnych, zanim dodasz kolejną.`;
  return null;
}

export async function saveHypothesis(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const id = uuid(fd, "id");
  const statement = str(fd, "statement");
  if (!statement) return fail("Wpisz treść hipotezy.");
  const status = (HYPOTHESIS_STATUSES as readonly string[]).includes(str(fd, "status")) ? str(fd, "status") : "idea";
  const constraintId = uuid(fd, "constraint_id");
  const nodeId = uuid(fd, "node_id");
  if (ACTIVE_HYPOTHESIS_STATUSES.includes(status)) {
    const problem = await guardActivation(line.id, id, constraintId);
    if (problem) return fail(problem);
  }
  const cycle = ACTIVE_HYPOTHESIS_STATUSES.includes(status) ? await activeCycle(line.id) : null;
  const data = {
    statement, constraint_id: constraintId, node_id: nodeId, expected_impact: str(fd, "expected_impact"),
    impact: clamp(int(fd, "impact")), confidence: clamp(int(fd, "confidence")), effort: clamp(int(fd, "effort")),
    speed: clamp(int(fd, "speed")), time_to_learn: str(fd, "time_to_learn"), economic_upside: str(fd, "economic_upside"),
    owner_id: uuid(fd, "owner_id"), status, result: str(fd, "result"),
  };
  if (id) {
    await sql`update hypotheses set ${sql(data)}, cycle_id = coalesce(${cycle?.id ?? null}, cycle_id) where id = ${id} and business_line_id = ${line.id}`;
    return back({ notice: "Zapisano hipotezę." });
  }
  const [h] = await sql`insert into hypotheses ${sql({ ...data, business_line_id: line.id, created_by: user.id, cycle_id: cycle?.id ?? null })} returning id`;
  if (nodeId) await sql`insert into hypothesis_node_links (hypothesis_id, node_id) values (${h.id}, ${nodeId}) on conflict do nothing`;
  if (str(fd, "stay") === "1") return back({ notice: "Dodano hipotezę i połączono ją z tym elementem." });
  revalidatePath("/", "layout");
  redirect(`/b/${line.slug}/hypotheses/${h.id}`);
}

export async function linkHypothesisNode(fd: FormData) {
  const { line } = await lineCtx(fd, "contribute");
  const hypothesisId = uuid(fd, "hypothesis_id");
  const nodeId = uuid(fd, "node_id");
  if (!hypothesisId || !nodeId) return fail("Wybierz hipotezę.");
  const [h] = await sql`select id from hypotheses where id = ${hypothesisId} and business_line_id = ${line.id}`;
  if (!h) return fail("Nie znaleziono hipotezy.");
  if (str(fd, "unlink") === "1") await sql`delete from hypothesis_node_links where hypothesis_id = ${hypothesisId} and node_id = ${nodeId}`;
  else await sql`insert into hypothesis_node_links (hypothesis_id, node_id) values (${hypothesisId}, ${nodeId}) on conflict do nothing`;
  return back();
}

// ───────────── Experiments

export async function saveExperiment(fd: FormData) {
  const { line } = await lineCtx(fd, "contribute");
  const id = uuid(fd, "id");
  const hypothesisId = uuid(fd, "hypothesis_id");
  const name = str(fd, "name");
  if (!name) return fail("Podaj nazwę eksperymentu.");
  const status = ["planned", "running", "completed", "stopped"].includes(str(fd, "status")) ? str(fd, "status") : "planned";
  if (status === "running") {
    const [{ n }] = await sql`select count(*)::int as n from experiments where business_line_id = ${line.id} and status = 'running' and id is distinct from ${id}`;
    if (n >= MAX_ACTIVE) return fail(`Maksymalnie ${MAX_ACTIVE} aktywne eksperymenty naraz. Zakończ jeden z trwających, zanim uruchomisz kolejny.`);
  }
  const data = {
    name, design: str(fd, "design"), metric: str(fd, "metric"), baseline: str(fd, "baseline"), target: str(fd, "target"),
    start_date: opt(fd, "start_date"), deadline: opt(fd, "deadline"), owner_id: uuid(fd, "owner_id"), status, result: str(fd, "result"),
  };
  if (id) await sql`update experiments set ${sql(data)} where id = ${id} and business_line_id = ${line.id}`;
  else {
    const [h] = await sql`select id, cycle_id from hypotheses where id = ${hypothesisId} and business_line_id = ${line.id}`;
    if (!h) return fail("Eksperyment musi być przypisany do hipotezy.");
    const cycle = await activeCycle(line.id);
    await sql`insert into experiments ${sql({ ...data, business_line_id: line.id, hypothesis_id: h.id, cycle_id: h.cycle_id ?? cycle?.id ?? null })}`;
  }
  return back({ notice: "Zapisano eksperyment." });
}
