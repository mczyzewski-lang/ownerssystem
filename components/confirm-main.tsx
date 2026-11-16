import Link from "next/link";
import { setConstraintStatus } from "@/lib/actions/constraints";
import { Submit } from "./client";
import { Card, Field } from "./ui";

/** Guard: one business line = one MAIN CONSTRAINT. Shown when someone tries to promote a second one. */
export function ConfirmMain({ slug, current, pending, cancelHref }: { slug: string; current: { name: string }; pending: { id: string; name: string }; cancelHref: string }) {
  return (
    <Card className="mb-6 border-critical/40 bg-critical-soft/40">
      <h2 className="h2">Ta linia ma już aktywny Primary Constraint. Czy na pewno chcesz otworzyć drugi?</h2>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
        W jednej linii biznesowej może istnieć tylko jeden MAIN CONSTRAINT. Obecnie jest nim <b>{current.name}</b>. Ustawienie <b>{pending.name}</b> jako
        MAIN zdejmie ten status z obecnego constraintu — jego historia zostanie zachowana.
      </p>
      <form action={setConstraintStatus} className="mt-4 grid gap-3 sm:grid-cols-[240px_1fr_auto] sm:items-end">
        <input type="hidden" name="line" value={slug} /><input type="hidden" name="constraint_id" value={pending.id} />
        <input type="hidden" name="status" value="main" /><input type="hidden" name="confirm" value="1" />
        <Field label={`${current.name} becomes`}>
          <select name="previous_to" className="input">
            <option value="resolved">Resolved / Previously constrained</option>
            <option value="watch">Watch</option>
            <option value="candidate">Candidate Constraint</option>
          </select>
        </Field>
        <Field label="Reason"><input name="reason" required className="input" placeholder="Dlaczego zmieniamy główny constraint?" /></Field>
        <div className="flex gap-2"><Submit className="btn-primary">Replace main constraint</Submit><Link href={cancelHref} className="btn">Cancel</Link></div>
      </form>
    </Card>
  );
}
