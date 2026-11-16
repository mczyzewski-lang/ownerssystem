import { saveHypothesis } from "@/lib/actions/growth";
import { Submit } from "./client";
import { Field, UserSelect } from "./ui";
import { HYPOTHESIS_STATUSES, titleCase } from "@/lib/utils";

type H = Partial<{
  id: string; statement: string; constraint_id: string | null; node_id: string | null; expected_impact: string; impact: number; confidence: number;
  effort: number; speed: number; time_to_learn: string; economic_upside: string; owner_id: string | null; status: string; result: string;
}>;

export function HypothesisForm({ slug, h = {}, constraints, sections, users, mainId }: {
  slug: string; h?: H; constraints: { id: string; number: number; name: string }[]; sections: { id: string; label: string }[];
  users: { id: string; name: string }[]; mainId?: string | null;
}) {
  const n = (name: string, label: string, v?: number) => (
    <Field label={label}><input name={name} type="number" min={1} max={10} defaultValue={v ?? 5} className="input" /></Field>
  );
  return (
    <form action={saveHypothesis} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="line" value={slug} />{h.id && <input type="hidden" name="id" value={h.id} />}
      <Field label="Hypothesis" className="sm:col-span-4">
        <textarea name="statement" required rows={3} defaultValue={h.statement} className="input" placeholder="Np. „Dodanie success fee zwiększy close rate o >15% bez obniżenia gross profit per lead.”" />
      </Field>
      <Field label="Constraint" className="sm:col-span-2">
        <select name="constraint_id" defaultValue={h.constraint_id ?? mainId ?? ""} className="input">
          <option value="">—</option>
          {constraints.map((c) => <option key={c.id} value={c.id}>{c.number}. {c.name}{c.id === mainId ? " — MAIN" : ""}</option>)}
        </select>
      </Field>
      <Field label="Subcategory" className="sm:col-span-2">
        <select name="node_id" defaultValue={h.node_id ?? ""} className="input">
          <option value="">—</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Expected impact" className="sm:col-span-2"><input name="expected_impact" defaultValue={h.expected_impact} className="input" placeholder="close rate +15%" /></Field>
      <Field label="Economic upside"><input name="economic_upside" defaultValue={h.economic_upside} className="input" placeholder="+40k/month" /></Field>
      <Field label="Time to learn"><input name="time_to_learn" defaultValue={h.time_to_learn} className="input" placeholder="14 days" /></Field>
      {n("impact", "Impact 1–10", h.impact)}
      {n("confidence", "Confidence 1–10", h.confidence)}
      {n("speed", "Speed to learn 1–10", h.speed)}
      {n("effort", "Effort 1–10", h.effort)}
      <Field label="Owner"><UserSelect name="owner_id" users={users} value={h.owner_id} /></Field>
      <Field label="Status">
        <select name="status" defaultValue={h.status ?? "idea"} className="input">
          {HYPOTHESIS_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </Field>
      <Field label="Result" className="sm:col-span-2"><input name="result" defaultValue={h.result} className="input" /></Field>
      <div className="sm:col-span-4"><Submit className="btn-primary">{h.id ? "Save hypothesis" : "Add hypothesis"}</Submit></div>
    </form>
  );
}

