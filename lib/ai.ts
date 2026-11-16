import OpenAI from "openai";
import { sql } from "./db";
import { getRoadmapState, getStageHistory } from "./roadmap-data";
import { FRAMEWORK_NAME, stageLabel } from "./roadmap";
import { hypothesisScore, truncate } from "./utils";

// OpenAI is used server-side only. The model is configurable (OPENAI_MODEL) — never hardcoded.
export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
}
export const AI_NOT_CONFIGURED =
  "AI nie jest skonfigurowane. Ustaw OPENAI_API_KEY i OPENAI_MODEL w zmiennych środowiskowych serwera.";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function complete(messages: Msg[], opts: { json?: boolean } = {}): Promise<string> {
  if (!aiConfigured()) throw new Error(AI_NOT_CONFIGURED);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 110_000, maxRetries: 1 });
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("AI zwróciło pustą odpowiedź.");
  return text;
}

export const SYSTEM_PROMPT = `Jesteś Growth AI Assistant w aplikacji GROWTH ARCHITECT OS — "second brain / diagnostic partner" Growth Architecta i ownerów linii biznesowych.

Filozofia systemu: BUSINESS LINE → CONSTRAINT CATEGORY → DIAGNOSIS → ROOT CAUSE → HYPOTHESES → EXPERIMENTS → METRIC → RESULT → NEXT CONSTRAINT.
Jeden główny constraint naraz → hipotezy dotyczące tego constraintu → eksperymenty → wynik. Nie pomagasz robić 10 rzeczy naraz.

Zasady:
- NIGDY nie zmieniasz constraintu ani etapu — tylko rekomendujesz. Decyzję podejmują ludzie.
- Opieraj się na danych z kontekstu. Wyraźnie rozróżniaj CURRENT DATA od HISTORICAL DATA i mów, na czym opierasz wniosek.
- Gdy brakuje danych, powiedz jakich — nie zgaduj liczb i nie wymyślaj faktów o biznesie.
- Trzymaj limity: maksymalnie 5 hipotez, maksymalnie 3 eksperymenty, chyba że poproszono o mniej.
- Każda rekomendacja ma pomagać odpowiedzieć na: (1) co najbardziej ogranicza ten biznes, (2) skąd to wiemy, (3) dlaczego constraint istnieje, (4) jakie hipotezy mogą go usunąć, (5) po czym poznamy, że został rozwiązany.
- Odpowiadaj po polsku, zwięźle, w Markdown, z nagłówkami sekcji dokładnie takimi, o jakie poproszono.

${FRAMEWORK_NAME} — zasady użycia:
The Hormozi Roadmap is a diagnostic lens, NOT the source of truth. Kolejność priorytetów:
1. Actual business economics  2. Actual funnel data  3. Observed constraint  4. Root cause analysis  5. Hormozi Roadmap as supporting/challenging framework.
Traktuj roadmapę jako OSOBNY system diagnostyczny od Constraint Engine. Nie zakładaj, że "stage Hormoziego = Primary Constraint".
Nigdy nie mów "Jesteś Stage X, więc musisz robić Y" bez sprawdzenia danych biznesu. Mów: "Biznes wygląda na Stage X. Typowym problemem tego etapu jest A. Wasze dane wskazują B. Te dwa sygnały są zgodne / niezgodne."
Etapu nie przypisuj wyłącznie po headcount — headcount to tylko sygnał. Oceniaj według: zachowania biznesu, powtarzalności acquisition, monetization, struktury organizacyjnej, rodzaju problemów, dojrzałości procesów, LTV:CAC, founder dependency, liczby produktów, stopnia specjalizacji.`;

export type AiAction = {
  label: string;
  group: "diagnosis" | "analysis" | "hypotheses" | "session" | "roadmap";
  prompt: string;
  input?: string; // label of the optional/required free-text input
  inputRequired?: boolean;
  json?: boolean;
};

export const AI_ACTIONS: Record<string, AiAction> = {
  diagnose: {
    label: "Diagnose Business",
    group: "diagnosis",
    prompt: `Zdiagnozuj tę linię biznesową. Odpowiedz w sekcjach:
1. Most likely Primary Constraint
2. Evidence
3. Confidence
4. Alternative constraint
5. Missing data
6. Root cause hypotheses
7. Recommended next analysis
8. Max 3 experiments`,
  },
  challenge_constraint: {
    label: "Challenge Current Constraint",
    group: "diagnosis",
    prompt: `Spróbuj OBALIĆ naszą obecną diagnozę Primary Constraint. Jakie dowody wskazują, że problem może leżeć wcześniej lub później w łańcuchu (np. w ICP, ofercie, jakości leadów)? Podaj: najsilniejsze kontrargumenty, jakie dane by je potwierdziły lub obaliły, oraz werdykt: czy diagnoza się broni.`,
  },
  analyze_funnel: {
    label: "Analyze Funnel",
    group: "analysis",
    prompt: `Przeanalizuj funnel. Wskaż: biggest mathematical leakage, highest economic leverage, anomalous steps, missing metrics.`,
  },
  analyze_icp: { label: "Analyze ICP", group: "analysis", prompt: `Przeanalizuj obszar MARKET / ICP tej linii: co wiemy, czego nie wiemy, największe ryzyka, które segmenty warto zbadać i jakie dane zebrać.` },
  analyze_offer: { label: "Analyze Offer", group: "analysis", prompt: `Przeanalizuj OFFER / VALUE PROPOSITION: core offer, guarantee, packaging, proof. Wskaż najsłabsze elementy i dlaczego.` },
  analyze_pricing: { label: "Analyze Pricing", group: "analysis", prompt: `Przeanalizuj PRICING: model cenowy, base + success fee, price testing. Wskaż ryzyka (cashflow, margin, collections) i co warto przetestować.` },
  analyze_sales: { label: "Analyze Sales", group: "analysis", prompt: `Przeanalizuj SALES: lead → appointment, show-up, sales conversion, follow-up, różnice między handlowcami, zarządzanie sprzedażą.` },
  analyze_delivery: { label: "Analyze Delivery", group: "analysis", prompt: `Przeanalizuj DELIVERY ECONOMICS / CAPACITY: marża, capacity, proces, koszt komunikacji, jakość, skalowalność.` },
  generate_hypotheses: {
    label: "Generate Hypotheses",
    group: "hypotheses",
    prompt: `Wygeneruj MAKSYMALNIE 5 hipotez wzrostu dotyczących obecnego Primary Constraint (jeśli go nie ma — najbardziej prawdopodobnego). Każda: testowalne twierdzenie z metryką i progiem, constraint/subkategoria, expected upside, confidence 1–10, effort 1–10, time to learn. Nie generuj hipotez spoza constraintu.`,
  },
  prioritize_hypotheses: {
    label: "Prioritize Hypotheses",
    group: "hypotheses",
    prompt: `Spriorytetyzuj istniejące hipotezy według Score = Impact × Confidence × Speed to Learn ÷ Effort. Pokaż tabelę, skomentuj oceny, z którymi się nie zgadzasz, i wskaż maksymalnie 3 hipotezy do aktywnego testowania w tym Growth Cycle.`,
  },
  prepare_session: {
    label: "Prepare Growth Session",
    group: "session",
    prompt: `Przygotuj Growth Session. Sekcje: co zmieniło się od ostatniego spotkania, metric (baseline → current → target), active experiments, blockers, decyzje do podjęcia.`,
  },
  summarize_session: {
    label: "Summarize Growth Session",
    group: "session",
    input: "Notatki ze spotkania",
    inputRequired: true,
    prompt: `Podsumuj Growth Session na podstawie notatek. Sekcje: decisions, hypothesis changes, assigned actions (kto / co / kiedy), new evidence, change in confidence, next meeting.`,
  },
  analyze_item: {
    label: "Analyze this item",
    group: "analysis",
    prompt: `Przeanalizuj wskazany element checklisty w kontekście tej linii biznesowej: co wiemy z danych, czy to może być constraint lub jego przyczyna, jakie dane sprawdzić i maksymalnie 2 hipotezy, jeśli mają sens.`,
  },
  // ── Hormozi $100M Scaling Roadmap
  assess_stage: {
    label: "Assess Scaling Stage",
    group: "roadmap",
    json: true,
    prompt: `Oceń etap tej linii biznesowej na Hormozi $100M Scaling Roadmap (0–9). Przeanalizuj WSZYSTKIE dane linii. Nie przypisuj etapu wyłącznie po headcount.
Zwróć WYŁĄCZNIE obiekt JSON:
{
  "current_stage": <0-9>,
  "confidence": <0-100>,
  "why": ["..."],
  "previous_stage_requirements": [{"stage": <n>, "status": "PASS" | "FAIL" | "UNKNOWN", "note": "..."}],
  "current_stage_constraint": "...",
  "graduate_by": "...",
  "most_relevant_actions": ["...", "...", "..."],
  "next_stage": <n lub null>,
  "readiness_indicators": ["co wskazywałoby na gotowość do kolejnego etapu"],
  "structural_stage": <etap wynikający z wielkości organizacji lub null>,
  "lowest_unresolved_stage": <najniższy etap z nierozwiązanymi wymaganiami lub null>,
  "observed_vs_expected": "Biznes wygląda na Stage X. Typowym problemem tego etapu jest A. Wasze dane wskazują B. Te dwa sygnały są zgodne / niezgodne, bo ...",
  "missing_data": ["..."]
}
previous_stage_requirements ma obejmować każdy etap niższy niż current_stage. Teksty po polsku.`,
  },
  hormozi_fix_next: {
    label: "What Would Hormozi Fix Next?",
    group: "roadmap",
    prompt: `Odpowiedz w sekcjach: CURRENT STAGE, EXPECTED CONSTRAINT, OBSERVED CONSTRAINT, ALIGNMENT, NEXT PRIORITY, WHY, WHAT NOT TO DO. NEXT PRIORITY musi wynikać z danych biznesu, a roadmapa ma je wspierać lub kwestionować.`,
  },
  challenge_stage: {
    label: "Challenge Stage",
    group: "roadmap",
    prompt: `Spróbuj UDOWODNIĆ, że etap roadmapy został źle wybrany. Podaj najsilniejsze argumenty za etapem niższym i za wyższym, dowody z danych, czego brakuje do rozstrzygnięcia, oraz werdykt.`,
  },
  graduation_audit: {
    label: "Graduation Audit",
    group: "roadmap",
    prompt: `Czy biznes naprawdę zakończył obecny etap? Przejdź przez graduation checklist obecnego etapu: dla każdego punktu PASS / FAIL / UNKNOWN z dowodem z danych. Zakończ werdyktem: READY TO GRADUATE / NOT READY i listą braków.`,
  },
  stage_regression: {
    label: "Stage Regression / Stage Debt",
    group: "roadmap",
    prompt: `Sprawdź Stage Debt: czy organizacja urosła szybciej niż jej systemy? Podaj: ORGANIZATIONAL SIZE (etap strukturalny), UNRESOLVED BUSINESS MATURITY (najniższy nierozwiązany etap), STAGE DEBT (LOW/MEDIUM/HIGH), wszystkie nierozwiązane wymagania wcześniejszych etapów z dowodami oraz co naprawić najpierw.`,
  },
  explain_mismatch: {
    label: "Explain Diagnostic Mismatch",
    group: "roadmap",
    prompt: `Observed Primary Constraint i typowy constraint etapu roadmapy się różnią. Dlaczego rzeczywisty constraint może różnić się od typowego problemu tego etapu? Rozważ: (a) obserwowany constraint jest objawem problemu etapu, (b) etap jest źle oceniony, (c) to realna specyfika tego biznesu. Wskaż, które wyjaśnienie najlepiej wspierają dane i jakie dane by to rozstrzygnęły.`,
  },
};

const list = (rows: string[]) => (rows.length ? rows.join("\n") : "(brak)");

/** Everything the assistant may know about a business line, split into CURRENT and HISTORICAL data. */
export async function buildContext(line: { id: string; name: string; description: string; headcount: number | null }, excludeConversationId?: string): Promise<string> {
  const id = line.id;
  const [constraints, nodes, comments, cycles, hypotheses, experiments, funnel, metrics, decisions, imports, history, convs] = await Promise.all([
    sql`select c.number, c.name, coalesce(r.status,'not_reviewed') as status, r.score, r.evidence, r.data_notes
        from constraints c left join constraint_reviews r on r.constraint_id = c.id and r.business_line_id = ${id} order by c.number`,
    sql`with recursive path as (
          select n.id, n.title::text as path from checklist_nodes n where n.parent_id is null
          union all select n.id, p.path || ' → ' || n.title from checklist_nodes n join path p on p.id = n.parent_id)
        select c.name as constraint_name, p.path, r.status, r.checked, r.note, r.evidence, r.metric
        from checklist_reviews r join checklist_nodes n on n.id = r.node_id join path p on p.id = n.id
        join constraints c on c.id = n.constraint_id
        where r.business_line_id = ${id} and (r.status <> 'not_reviewed' or r.checked or r.note <> '' or r.evidence <> '' or r.metric <> '')
        order by c.number, p.path limit 300`,
    sql`select cm.created_at, cm.body, cm.target_type, cm.status, u.name as author,
               coalesce(n.title, c.name, h.statement, '') as target
        from comments cm left join users u on u.id = cm.author_id
        left join checklist_nodes n on cm.target_type = 'node' and n.id = cm.target_id
        left join constraints c on cm.target_type = 'constraint' and c.id = cm.target_id
        left join hypotheses h on cm.target_type = 'hypothesis' and h.id = cm.target_id
        where cm.business_line_id = ${id} order by cm.created_at desc limit 80`,
    sql`select g.*, c.name as constraint_name, u.name as owner from growth_cycles g
        left join constraints c on c.id = g.constraint_id left join users u on u.id = g.owner_id
        where g.business_line_id = ${id} order by (g.status = 'active') desc, g.start_date desc nulls last`,
    sql`select h.*, c.name as constraint_name, n.title as node_title from hypotheses h
        left join constraints c on c.id = h.constraint_id left join checklist_nodes n on n.id = h.node_id
        where h.business_line_id = ${id} order by h.created_at desc limit 60`,
    sql`select e.name, e.status, e.metric, e.baseline, e.target, e.deadline, e.result, e.design, h.statement
        from experiments e join hypotheses h on h.id = e.hypothesis_id where e.business_line_id = ${id} order by e.created_at desc limit 40`,
    sql`select d.period_start, d.period_end, d.segment, d.source, s.name, s.position, d.volume, d.revenue
        from funnel_data d join funnel_steps s on s.id = d.step_id join funnel_definitions f on f.id = d.funnel_id
        where f.business_line_id = ${id} order by d.period_end desc, d.segment, d.source, s.position limit 400`,
    sql`select name, value, unit, period_start, period_end, source, note from metrics where business_line_id = ${id} order by created_at desc limit 60`,
    sql`select decision_date, decision, why, evidence, expected_result, result from decisions where business_line_id = ${id} order by decision_date desc limit 40`,
    sql`select name, kind, import_date, source, description, raw_content from data_imports where business_line_id = ${id} order by created_at desc limit 12`,
    sql`select h.changed_at, c.name, h.from_status, h.to_status, h.reason from constraint_status_history h
        join constraints c on c.id = h.constraint_id where h.business_line_id = ${id} order by h.changed_at desc limit 40`,
    sql`select v.id, v.title, v.created_at, v.constraint_snapshot,
               (select content from ai_messages m where m.conversation_id = v.id and m.role = 'assistant' order by created_at desc limit 1) as last_answer
        from ai_conversations v where v.business_line_id = ${id} order by v.created_at desc limit 9`,
  ]);
  const roadmap = await getRoadmapState(line);
  const stageHistory = await getStageHistory(id);

  const main = constraints.find((c) => c.status === "main");
  const active = cycles.find((c) => c.status === "active");
  const pastCycles = cycles.filter((c) => c.status !== "active");

  // funnel: group rows into datasets
  const datasets = new Map<string, string[]>();
  for (const r of funnel) {
    const k = `${r.period_start}–${r.period_end}${r.segment ? ` | segment: ${r.segment}` : ""}${r.source ? ` | source: ${r.source}` : ""}`;
    if (!datasets.has(k)) datasets.set(k, []);
    datasets.get(k)!.push(`${r.name}: ${Number(r.volume)}${r.revenue != null ? ` (revenue ${Number(r.revenue)})` : ""}`);
  }

  let budget = 24_000;
  const importsText = imports.map((i) => {
    const take = Math.max(0, Math.min(4_000, budget));
    budget -= take;
    return `### ${i.name} [${i.kind}, ${i.import_date}${i.source ? `, source: ${i.source}` : ""}]\n${i.description}\n${truncate(i.raw_content, take)}`;
  });

  const s = roadmap.current;
  const checklist = (n: number) => roadmap.items.filter((i) => i.stage_number === n)
    .map((i) => `  [${i.status.toUpperCase()}] ${i.text}${i.evidence ? ` — evidence: ${i.evidence}` : ""}${i.comment ? ` — ${i.comment}` : ""}`);

  return `# BUSINESS LINE: ${line.name}

═══════════ CURRENT DATA ═══════════

## Business description
${line.description || "(brak opisu)"}
Headcount (tylko sygnał): ${line.headcount ?? "nieznany"}

## Observed Primary Constraint (Constraint Engine)
${main ? `${main.name}` : "BRAK — linia w fazie diagnozy"}

## Active Growth Cycle
${active ? `${active.name} (${active.start_date ?? "?"} – ${active.end_date ?? "?"})
Primary Constraint: ${active.constraint_name ?? "—"} | Metric: ${active.primary_metric} | Baseline: ${active.baseline} | Target: ${active.target}
Economic upside: ${active.economic_upside} | Confidence: ${active.confidence} | Owner: ${active.owner ?? "—"}
Root causes:\n${active.root_causes}
Condition of Victory: ${active.condition_of_victory}` : "(brak aktywnego cyklu)"}

## Constraint Map
${list(constraints.map((c) => `${c.number}. ${c.name}: ${c.status}${c.score ? `, score ${c.score}/10` : ""}${c.evidence ? ` — evidence: ${c.evidence}` : ""}${c.data_notes ? ` — data: ${c.data_notes}` : ""}`))}

## Checklist reviews (tylko uzupełnione)
${list(nodes.map((n) => `- [${n.constraint_name}] ${n.path}: ${n.status}${n.checked ? " ✓" : ""}${n.note ? ` | note: ${n.note}` : ""}${n.evidence ? ` | evidence: ${n.evidence}` : ""}${n.metric ? ` | metric: ${n.metric}` : ""}`))}

## Funnel data
${datasets.size ? [...datasets].map(([k, v]) => `- ${k}: ${v.join(" → ")}`).join("\n") : "(brak danych funnelu)"}

## Metrics
${list(metrics.map((m) => `- ${m.name}: ${m.value}${m.unit ? " " + m.unit : ""} (${m.period_start ?? "?"} – ${m.period_end ?? "?"})${m.note ? ` — ${m.note}` : ""}`))}

## Hypotheses
${list(hypotheses.map((h) => `- [${h.status}] ${h.statement} | constraint: ${h.constraint_name ?? "—"}${h.node_title ? ` / ${h.node_title}` : ""} | impact ${h.impact}, confidence ${h.confidence}, speed ${h.speed}, effort ${h.effort}, score ${hypothesisScore(h as never)}${h.economic_upside ? ` | upside: ${h.economic_upside}` : ""}${h.result ? ` | result: ${h.result}` : ""}`))}

## Experiments
${list(experiments.map((e) => `- [${e.status}] ${e.name} (hipoteza: ${truncate(e.statement, 90)}) | metric: ${e.metric} ${e.baseline} → ${e.target} | deadline: ${e.deadline ?? "—"}${e.result ? ` | result: ${e.result}` : ""}`))}

## ${FRAMEWORK_NAME} (soczewka diagnostyczna, nie źródło prawdy)
Assessed stage: ${stageLabel(s)}
${s ? `Typical constraint of this stage: ${s.main_constraint}\nGraduate by: ${s.graduate_by}\nHormozi question: ${s.question}` : ""}
Structural stage (headcount signal): ${roadmap.headcountStage ?? "nieznany"}
Stage debt: ${roadmap.debt.level ?? "n/a"}${roadmap.debt.lowestUnresolved != null ? ` (lowest unresolved stage: ${roadmap.debt.lowestUnresolved})` : ""}
Alignment (deterministic): ${roadmap.alignment.verdict}
Stages: ${roadmap.stages.map((x) => `${x.number} ${x.name} (${x.headcount_label}): ${x.main_constraint}`).join(" | ")}
Graduation checklist reviews:
${roadmap.stages.filter((x) => s == null || x.number <= s.number).map((x) => `Stage ${x.number} ${x.name}:\n${checklist(x.number).join("\n")}`).join("\n")}

## Recent comments
${list(comments.map((c) => `- ${String(c.created_at.toISOString?.() ?? c.created_at).slice(0, 10)} ${c.author ?? "?"} @ ${c.target_type}${c.target ? ` „${truncate(c.target, 60)}”` : ""}: ${truncate(c.body, 400)}`))}

## Data Room (uploaded data, raw)
${importsText.length ? importsText.join("\n\n") : "(brak importów)"}

═══════════ HISTORICAL DATA ═══════════

## Previous Growth Cycles
${list(pastCycles.map((c) => `- ${c.name} [${c.status}] ${c.start_date ?? "?"} – ${c.end_date ?? "?"} | constraint: ${c.constraint_name ?? "—"} | ${c.primary_metric} ${c.baseline} → ${c.target} | result: ${c.result || "—"} | retro: ${c.retrospective || "—"}`))}

## Constraint status history
${list(history.map((h) => `- ${h.changed_at.toISOString().slice(0, 10)} ${h.name}: ${h.from_status ?? "—"} → ${h.to_status}${h.reason ? ` (${h.reason})` : ""}`))}

## Decision log
${list(decisions.map((d) => `- ${d.decision_date}: ${d.decision} | why: ${d.why}${d.result ? ` | result: ${d.result}` : ""}`))}

## Roadmap stage history
${list(stageHistory.map((a) => `- ${a.assessed_on}: Stage ${a.stage_number} [${a.source}, ${a.status}${a.manual_override ? ", manual override" : ""}] ${a.reason}`))}

## Earlier AI conversations (stan wiedzy z tamtego czasu — może być nieaktualny)
${list(convs.filter((c) => c.id !== excludeConversationId).slice(0, 8).map((c) => `- ${c.created_at.toISOString().slice(0, 10)} „${c.title}” (constraint wtedy: ${c.constraint_snapshot || "—"}): ${truncate(c.last_answer ?? "", 700)}`))}
`;
}
