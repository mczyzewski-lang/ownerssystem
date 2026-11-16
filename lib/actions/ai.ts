"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "../db";
import { AI_ACTIONS, AI_NOT_CONFIGURED, SYSTEM_PROMPT, aiConfigured, buildContext, complete } from "../ai";
import { fail, lineCtx, str, uuid } from "../action-utils";
import type { AiStageAssessment } from "../roadmap-data";
import { truncate } from "../utils";

async function snapshot(lineId: string) {
  const [main] = await sql`select c.name from constraint_reviews r join constraints c on c.id = r.constraint_id
                           where r.business_line_id = ${lineId} and r.status = 'main'`;
  const [cycle] = await sql`select id, name, start_date, end_date from growth_cycles where business_line_id = ${lineId} and status = 'active'`;
  return {
    constraint: main?.name ?? "",
    cycleId: (cycle?.id as string) ?? null,
    cycle: cycle ? `${cycle.name}${cycle.start_date ? ` (${cycle.start_date} – ${cycle.end_date ?? "?"})` : ""}` : "",
  };
}

function parseAssessment(text: string): AiStageAssessment {
  const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  const stage = Number(raw.current_stage);
  if (!Number.isInteger(stage) || stage < 0 || stage > 9) throw new Error("AI nie zwróciło poprawnego etapu (0–9).");
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
  const n = (v: unknown) => (Number.isInteger(Number(v)) && v !== null && v !== "" && Number(v) >= 0 && Number(v) <= 9 ? Number(v) : null);
  return {
    current_stage: stage,
    confidence: Math.min(100, Math.max(0, Math.round(Number(raw.confidence) || 0))),
    why: arr(raw.why),
    previous_stage_requirements: Array.isArray(raw.previous_stage_requirements)
      ? raw.previous_stage_requirements.map((r: Record<string, unknown>) => ({ stage: Number(r.stage), status: String(r.status ?? "UNKNOWN").toUpperCase(), note: String(r.note ?? "") }))
      : [],
    current_stage_constraint: String(raw.current_stage_constraint ?? ""),
    graduate_by: String(raw.graduate_by ?? ""),
    most_relevant_actions: arr(raw.most_relevant_actions).slice(0, 3),
    next_stage: n(raw.next_stage),
    readiness_indicators: arr(raw.readiness_indicators),
    structural_stage: n(raw.structural_stage),
    lowest_unresolved_stage: n(raw.lowest_unresolved_stage),
    observed_vs_expected: String(raw.observed_vs_expected ?? ""),
    missing_data: arr(raw.missing_data),
  };
}

function assessmentMarkdown(a: AiStageAssessment, names: Map<number, string>): string {
  const st = (n: number | null | undefined) => (n == null ? "—" : `${n} — ${names.get(n) ?? "?"}`);
  return `**CURRENT STAGE:** ${st(a.current_stage)}

**CONFIDENCE:** ${a.confidence}%

**WHY:**
${a.why.map((w) => `- ${w}`).join("\n")}

**PREVIOUS STAGE REQUIREMENTS:**
${a.previous_stage_requirements.map((r) => `- Stage ${st(r.stage)}: **${r.status}**${r.note ? ` — ${r.note}` : ""}`).join("\n") || "—"}

**CURRENT STAGE CONSTRAINT:** ${a.current_stage_constraint}

**GRADUATE BY:** ${a.graduate_by}

**MOST RELEVANT ACTIONS:**
${a.most_relevant_actions.map((x, i) => `${i + 1}. ${x}`).join("\n")}

**NEXT STAGE:** ${st(a.next_stage)}

**WHAT WOULD INDICATE READINESS:**
${a.readiness_indicators.map((w) => `- ${w}`).join("\n")}

**OBSERVED vs EXPECTED:** ${a.observed_vs_expected || "—"}
${a.missing_data?.length ? `\n**MISSING DATA:**\n${a.missing_data.map((w) => `- ${w}`).join("\n")}` : ""}

_To jest propozycja. Etap w roadmapie zmieni się dopiero po akceptacji przez Growth Architecta._`;
}

/** Runs one of the predefined AI actions and stores it as a permanent conversation. */
export async function runAiAction(fd: FormData) {
  const key = str(fd, "action");
  const action = AI_ACTIONS[key];
  if (!action) return fail("Nieznana akcja AI.");
  // Predefined analyses are a Growth Architect tool; owners take part in the chat itself.
  const { line, user } = await lineCtx(fd, "manage");
  if (!aiConfigured()) return fail(AI_NOT_CONFIGURED);
  const input = str(fd, "input");
  if (action.inputRequired && !input) return fail(`Uzupełnij pole: ${action.input}.`);

  let extra = "";
  const nodeId = uuid(fd, "node_id");
  if (key === "analyze_item" && nodeId) {
    const [n] = await sql`
      with recursive up as (
        select id, parent_id, title, constraint_id, 0 as depth from checklist_nodes where id = ${nodeId}
        union all select p.id, p.parent_id, p.title, p.constraint_id, up.depth + 1 from checklist_nodes p join up on up.parent_id = p.id)
      select (select name from constraints where id = (select constraint_id from up limit 1)) || ' → ' ||
             string_agg(title, ' → ' order by depth desc) as path from up`;
    const [r] = await sql`select status, note, evidence, metric from checklist_reviews where business_line_id = ${line.id} and node_id = ${nodeId}`;
    extra = `\n\nELEMENT CHECKLISTY: ${n?.path ?? "?"}\nStatus: ${r?.status ?? "not_reviewed"} | Note: ${r?.note ?? ""} | Evidence: ${r?.evidence ?? ""} | Metric: ${r?.metric ?? ""}`;
  }

  const snap = await snapshot(line.id);
  let answer: string;
  let assessment: AiStageAssessment | null = null;
  try {
    const context = await buildContext(line);
    const text = await complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${context}\n\n═══════════ ZADANIE ═══════════\n${action.prompt}${extra}${input ? `\n\n${action.input ?? "Dodatkowy kontekst"}:\n${input}` : ""}` },
      ],
      { json: action.json },
    );
    if (key === "assess_stage") {
      assessment = parseAssessment(text);
      const names = new Map((await sql`select number, name from roadmap_stages`).map((s) => [s.number as number, s.name as string]));
      answer = assessmentMarkdown(assessment, names);
    } else answer = text;
  } catch (e) {
    return fail(`AI: ${truncate(e instanceof Error ? e.message : String(e), 300)}`);
  }

  const title = `${action.label} — ${new Date().toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}`;
  const convId = await sql.begin(async (tx) => {
    const [conv] = await tx`
      insert into ai_conversations (business_line_id, title, action, constraint_snapshot, cycle_id, cycle_snapshot, created_by)
      values (${line.id}, ${title}, ${key}, ${snap.constraint}, ${snap.cycleId}, ${snap.cycle}, ${user.id}) returning id`;
    await tx`insert into ai_messages (conversation_id, role, author_id, content)
             values (${conv.id}, 'user', ${user.id}, ${`[${action.label}]${extra ? extra : ""}${input ? `\n\n${input}` : ""}`})`;
    await tx`insert into ai_messages (conversation_id, role, content, created_at) values (${conv.id}, 'assistant', ${answer}, now() + interval '1 millisecond')`;
    if (assessment)
      await tx`insert into stage_assessments (business_line_id, stage_number, source, status, confidence, reason, ai_assessment, author_id)
               values (${line.id}, ${assessment.current_stage}, 'ai', 'proposed', ${assessment.confidence},
                       ${assessment.why.join("; ")}, ${tx.json(assessment)}, ${user.id})`;
    return conv.id as string;
  });
  revalidatePath("/", "layout");
  redirect(key === "assess_stage" ? `/b/${line.slug}/roadmap#assessment` : `/b/${line.slug}/ai?c=${convId}`);
}

/** Free chat in a business line's Growth AI Chat. Conversations are stored permanently. */
export async function sendChatMessage(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  if (!aiConfigured()) return fail(AI_NOT_CONFIGURED);
  const content = str(fd, "content");
  if (!content) return fail("Wpisz wiadomość.");
  let convId = uuid(fd, "conversation_id");
  if (convId) {
    const [c] = await sql`select id from ai_conversations where id = ${convId} and business_line_id = ${line.id}`;
    if (!c) return fail("Nie znaleziono rozmowy.");
  }
  const history = convId
    ? await sql<{ role: "user" | "assistant"; content: string }[]>`
        select role, content from ai_messages where conversation_id = ${convId} order by created_at limit 60`
    : [];
  let answer: string;
  try {
    const context = await buildContext(line, convId ?? undefined);
    answer = await complete([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\n(Powyżej kontekst linii biznesowej. Dalej rozmowa.)` },
      { role: "assistant", content: "Mam kontekst linii biznesowej. W czym pomóc?" },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content },
    ]);
  } catch (e) {
    return fail(`AI: ${truncate(e instanceof Error ? e.message : String(e), 300)}`);
  }
  await sql.begin(async (tx) => {
    if (!convId) {
      const snap = await snapshot(line.id);
      const [conv] = await tx`
        insert into ai_conversations (business_line_id, title, constraint_snapshot, cycle_id, cycle_snapshot, created_by)
        values (${line.id}, ${truncate(content, 70)}, ${snap.constraint}, ${snap.cycleId}, ${snap.cycle}, ${user.id}) returning id`;
      convId = conv.id as string;
    }
    await tx`insert into ai_messages (conversation_id, role, author_id, content) values (${convId}, 'user', ${user.id}, ${content})`;
    await tx`insert into ai_messages (conversation_id, role, content, created_at) values (${convId}, 'assistant', ${answer}, now() + interval '1 millisecond')`;
    await tx`update ai_conversations set updated_at = now() where id = ${convId}`;
  });
  revalidatePath("/", "layout");
  redirect(`/b/${line.slug}/ai?c=${convId}`);
}
