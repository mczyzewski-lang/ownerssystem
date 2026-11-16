import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAlignment, computeStageDebt, stageFromHeadcount, type ChecklistItem, type Stage } from "../lib/roadmap";
import { ROADMAP_STAGES } from "../db/seed/roadmap";
import { parseTaxonomy } from "../db/seed/taxonomy";

const stages: Stage[] = ROADMAP_STAGES.map((s) => ({
  number: s.number, key: s.key, name: s.name, role: s.role, headcount_label: s.headcountLabel,
  headcount_min: s.headcountMin, headcount_max: s.headcountMax, main_constraint: s.mainConstraint,
  typical_constraint: s.typicalConstraint, typical_symptom: s.typicalSymptom ?? "", graduate_by: s.graduateBy,
  question: s.question, note: s.note ?? "", guidance: s.guidance, strong_signals: s.strongSignals ?? [],
  primary_constraints: s.primaryConstraints, secondary_constraints: s.secondaryConstraints, mismatch_question: s.mismatchQuestion,
}));
const stage = (n: number) => stages[n];
const item = (stage_number: number, status: ChecklistItem["status"]): ChecklistItem => ({
  id: `${stage_number}-${Math.random()}`, stage_number, text: "x", status, comment: "", evidence: "", metric: "",
  owner_id: null, owner_name: null, updated_at: null,
});

test("taxonomy parses into 9 constraints with unique node keys", () => {
  const { constraints, nodes } = parseTaxonomy();
  assert.equal(constraints.length, 9);
  assert.equal(new Set(nodes.map((n) => n.key)).size, nodes.length);
  const fee = nodes.find((n) => n.title === "Czy klient postrzega alignment interesów?")!;
  assert.equal(fee.kind, "item");
  assert.equal(nodes.find((n) => n.key === fee.parentKey)!.title, "Base + Success Fee");
  // SHOW-UP items hang directly under the constraint
  assert.equal(nodes.find((n) => n.title === "reminder SMS")!.parentKey, null);
});

test("roadmap seed: every constraint key used by a stage exists in the taxonomy", () => {
  const keys = new Set(parseTaxonomy().constraints.map((c) => c.key));
  for (const s of ROADMAP_STAGES) for (const k of [...s.primaryConstraints, ...s.secondaryConstraints]) assert.ok(keys.has(k), `${s.name}: ${k}`);
  assert.equal(ROADMAP_STAGES.length, 10);
  assert.equal(ROADMAP_STAGES[6].checklist.length, 11);
});

test("headcount is mapped to the structural stage", () => {
  assert.equal(stageFromHeadcount(null, stages), null);
  assert.equal(stageFromHeadcount(0, stages), 0);
  assert.equal(stageFromHeadcount(1, stages), 1);
  assert.equal(stageFromHeadcount(3, stages), 3);
  assert.equal(stageFromHeadcount(7, stages), 4);
  assert.equal(stageFromHeadcount(30, stages), 6);
  assert.equal(stageFromHeadcount(60, stages), 7);
  assert.equal(stageFromHeadcount(80, stages), 7);
  assert.equal(stageFromHeadcount(5000, stages), 9);
});

test("Sales Conversion at OPTIMIZE is a strong alignment with a SALES recommendation", () => {
  const a = computeAlignment({ key: "sales_conversion", name: "SALES CONVERSION" }, stage(6));
  assert.equal(a.verdict, "STRONG DIAGNOSTIC ALIGNMENT");
  assert.equal(a.level, "VERY HIGH");
  assert.equal(a.recommendation?.area, "SALES");
  assert.ok(a.recommendation?.items.includes("poprawa close rate"));
  assert.equal(a.aiQuestion, null);
});

test("Lead Generation at PRODUCTIZE is a mismatch that asks the LTV question", () => {
  const a = computeAlignment({ key: "lead_generation", name: "LEAD GENERATION" }, stage(5));
  assert.equal(a.verdict, "DIAGNOSTIC MISMATCH");
  assert.match(a.aiQuestion!, /niski LTV powoduje, że nie jesteście w stanie ekonomicznie kupić większej liczby leadów/);
  assert.match(a.aiQuestion!, /Dlaczego rzeczywisty constraint może różnić się od typowego problemu tego etapu\?/);
});

test("alignment needs both an observed constraint and a stage", () => {
  assert.equal(computeAlignment(null, stage(6)).verdict, "ASSESSMENT NEEDED");
  assert.equal(computeAlignment({ key: "offer", name: "OFFER" }, null).verdict, "ASSESSMENT NEEDED");
  assert.equal(computeAlignment({ key: "offer", name: "OFFER" }, stage(5)).verdict, "PARTIAL ALIGNMENT");
});

test("stage debt: 80 people (Stage 7) with a failed Stage 4 requirement is HIGH", () => {
  const d = computeStageDebt({ currentStage: 7, structuralStage: 7, items: [item(4, "fail"), item(5, "pass"), item(6, "not_reviewed"), item(8, "fail")], stages });
  assert.equal(d.structuralStage, 7);
  assert.equal(d.lowestUnresolved, 4);
  assert.equal(d.level, "HIGH");
  assert.equal(d.failed.length, 1);
  assert.equal(d.unverified, 1);
  assert.match(d.action!, /Stage 8 — SPECIALIZE.*Stage 4 — PRIORITIZE/);
});

test("stage debt: organization larger than assessed maturity", () => {
  const d = computeStageDebt({ currentStage: 4, structuralStage: 7, items: [], stages });
  assert.equal(d.lowestUnresolved, 4);
  assert.equal(d.level, "HIGH");
});

test("stage debt: no failures means LOW, no stage means assessment needed", () => {
  assert.equal(computeStageDebt({ currentStage: 6, structuralStage: null, items: [item(3, "pass")], stages }).level, "LOW");
  assert.equal(computeStageDebt({ currentStage: 6, structuralStage: 5, items: [item(5, "fail")], stages }).level, "MEDIUM");
  assert.equal(computeStageDebt({ currentStage: null, structuralStage: null, items: [], stages }).level, null);
});
