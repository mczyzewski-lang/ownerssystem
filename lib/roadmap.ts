// Hormozi $100M Scaling Roadmap — reconstructed framework. Pure logic (no I/O).
//
// The roadmap is a diagnostic lens, NOT the source of truth. Priority order:
//   1. Actual business economics  2. Actual funnel data  3. Observed constraint
//   4. Root cause analysis        5. Hormozi Roadmap as supporting / challenging framework
// Nothing in this module ever changes the Primary Constraint.

export const FRAMEWORK_NAME = "Hormozi $100M Scaling Roadmap — reconstructed framework";
export const FRAMEWORK_DISCLAIMER =
  "Framework został odtworzony na podstawie dostępnych Personalized Guides i jest parafrazą ich znaczenia, a nie dosłowną kopią oryginalnej one-page roadmapy.";
export const LENS_RULE = "The Hormozi Roadmap is a diagnostic lens, NOT the source of truth.";
export const PRIORITY_ORDER = [
  "Actual business economics",
  "Actual funnel data",
  "Observed constraint",
  "Root cause analysis",
  "Hormozi Roadmap as supporting/challenging framework",
];

export type Stage = {
  number: number;
  key: string;
  name: string;
  role: string;
  headcount_label: string;
  headcount_min: number;
  headcount_max: number | null;
  main_constraint: string;
  typical_constraint: string;
  typical_symptom: string;
  graduate_by: string;
  question: string;
  note: string;
  guidance: { area: string; items: string[] }[];
  strong_signals: string[];
  primary_constraints: string[];
  secondary_constraints: string[];
  mismatch_question: string;
};

export type ChecklistItem = {
  id: string;
  stage_number: number;
  text: string;
  status: "not_reviewed" | "pass" | "fail";
  comment: string;
  evidence: string;
  metric: string;
  owner_id: string | null;
  owner_name: string | null;
  updated_at: string | null;
};

/** Headcount is only a signal: the lowest stage whose headcount band still fits the organization. */
export function stageFromHeadcount(headcount: number | null | undefined, stages: Stage[]): number | null {
  if (headcount == null || headcount < 0) return null;
  const sorted = [...stages].sort((a, b) => a.number - b.number);
  for (const s of sorted) if (s.headcount_max == null || headcount <= s.headcount_max) return s.number;
  return sorted.at(-1)?.number ?? null;
}

// Which guidance area of a stage speaks to which Constraint Engine area.
const GUIDANCE_AREAS: Record<string, string[]> = {
  market_icp: ["PRODUCT / OFFER", "MARKETING", "PRODUCT"],
  offer: ["OFFER", "PRODUCT / OFFER", "PRODUCT"],
  lead_generation: ["MARKETING"],
  lead_to_appointment: ["SALES"],
  show_up: ["SALES"],
  sales_conversion: ["SALES"],
  delivery: ["DELIVERY", "CUSTOMER SUCCESS", "PRODUCT"],
  ltv_expansion: ["CUSTOMER SUCCESS", "PRODUCT"],
  people_management: ["MANAGEMENT", "PEOPLE", "RECRUITMENT", "RECRUITING"],
};

export type Alignment = {
  verdict: "STRONG DIAGNOSTIC ALIGNMENT" | "PARTIAL ALIGNMENT" | "DIAGNOSTIC MISMATCH" | "ASSESSMENT NEEDED";
  level: "VERY HIGH" | "MEDIUM" | "LOW" | null;
  short: "High" | "Partial" | "Mismatch" | "—";
  interpretation: string;
  recommendation: { area: string; items: string[] } | null;
  aiQuestion: string | null;
};

export function computeAlignment(
  observed: { key: string; name: string } | null,
  stage: Stage | null,
): Alignment {
  if (!observed || !stage) {
    return {
      verdict: "ASSESSMENT NEEDED",
      level: null,
      short: "—",
      interpretation: !stage
        ? "Brak ocenionego etapu roadmapy. Użyj ASSESS HORMOZI STAGE albo ustaw etap ręcznie."
        : "Brak obserwowanego Primary Constraint. Najpierw zdiagnozuj constraint na podstawie danych linii biznesowej.",
      recommendation: null,
      aiQuestion: null,
    };
  }
  const areas = GUIDANCE_AREAS[observed.key] ?? [];
  const recommendation = areas.map((a) => stage.guidance.find((g) => g.area === a)).find(Boolean) ?? null;
  const label = `Stage ${stage.number} — ${stage.name}`;
  if (stage.primary_constraints.includes(observed.key)) {
    return {
      verdict: "STRONG DIAGNOSTIC ALIGNMENT",
      level: "VERY HIGH",
      short: "High",
      interpretation: `Dane wskazują ${observed.name}, a roadmapa (${label}) jako typowe ograniczenie tego etapu również wskazuje: „${stage.main_constraint}” Oba sygnały są zgodne — to wzmacnia diagnozę, ale jej nie zastępuje.`,
      recommendation,
      aiQuestion: null,
    };
  }
  const question =
    stage.mismatch_question.replace("{observed}", observed.name) +
    " Dlaczego rzeczywisty constraint może różnić się od typowego problemu tego etapu?";
  if (stage.secondary_constraints.includes(observed.key)) {
    return {
      verdict: "PARTIAL ALIGNMENT",
      level: "MEDIUM",
      short: "Partial",
      interpretation: `Dane wskazują ${observed.name}. Typowym ograniczeniem etapu ${label} jest „${stage.typical_constraint}” — obserwowany constraint jest z nim powiązany, ale nie jest jego rdzeniem. Sprawdź, czy nie jest objawem problemu etapu.`,
      recommendation,
      aiQuestion: question,
    };
  }
  return {
    verdict: "DIAGNOSTIC MISMATCH",
    level: "LOW",
    short: "Mismatch",
    interpretation: `Dane wskazują ${observed.name}, a typowym ograniczeniem etapu ${label} jest „${stage.typical_constraint}”. Te dwa sygnały są niezgodne. Pierwszeństwo mają dane biznesu — roadmapa służy tu do zakwestionowania diagnozy, nie do jej nadpisania.`,
    recommendation,
    aiQuestion: question,
  };
}

export type StageDebt = {
  level: "LOW" | "MEDIUM" | "HIGH" | null;
  structuralStage: number | null; // organizational size
  lowestUnresolved: number | null; // business maturity
  gap: number;
  failed: ChecklistItem[]; // explicitly failed requirements of earlier stages
  unverified: number; // earlier-stage requirements nobody reviewed yet
  message: string;
  action: string | null;
};

/**
 * Stage Debt: the organization grew structurally faster than its systems.
 * structural stage  = headcount signal (falls back to the assessed stage)
 * lowest unresolved = the earliest stage below the structural one with an explicitly FAILED
 *                     graduation requirement, capped by the assessed (maturity) stage.
 */
export function computeStageDebt(input: {
  currentStage: number | null;
  structuralStage: number | null;
  items: ChecklistItem[];
  stages: Stage[];
}): StageDebt {
  const { currentStage, structuralStage, items, stages } = input;
  if (currentStage == null && structuralStage == null) {
    return { level: null, structuralStage: null, lowestUnresolved: null, gap: 0, failed: [], unverified: 0, message: "Assessment needed.", action: null };
  }
  const top = Math.max(structuralStage ?? currentStage ?? 0, currentStage ?? 0);
  const earlier = items.filter((i) => i.stage_number < top);
  const failed = earlier.filter((i) => i.status === "fail").sort((a, b) => a.stage_number - b.stage_number);
  const unverified = earlier.filter((i) => i.status === "not_reviewed").length;
  const lowestFailed = failed.length ? failed[0].stage_number : top;
  const lowestUnresolved = Math.min(lowestFailed, currentStage ?? top);
  const gap = top - lowestUnresolved;
  const level = gap >= 3 ? "HIGH" : gap >= 1 ? "MEDIUM" : "LOW";
  const name = (n: number) => `Stage ${n} — ${stages.find((s) => s.number === n)?.name ?? "?"}`;
  return {
    level,
    structuralStage: top,
    lowestUnresolved,
    gap,
    failed,
    unverified,
    message:
      gap > 0
        ? "Firma urosła organizacyjnie szybciej niż jej systemy."
        : "Brak nierozwiązanych wymagań wcześniejszych etapów poniżej poziomu organizacji.",
    action:
      gap > 0
        ? `Nie rozwiązuj problemów ${name(Math.min(top + 1, 9))} przed naprawieniem fundamentalnego problemu ${name(lowestUnresolved)}.`
        : null,
  };
}

export function stageLabel(s: Pick<Stage, "number" | "name"> | null | undefined): string {
  return s ? `Stage ${s.number} — ${s.name}` : "Assessment needed";
}
