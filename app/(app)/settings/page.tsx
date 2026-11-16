import Link from "next/link";
import { Suspense } from "react";
import { listUsers, listVisibleLines, requireArchitect } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSectionOptions } from "@/lib/growth-data";
import { listConstraints } from "@/lib/line-data";
import { FRAMEWORK_DISCLAIMER, FRAMEWORK_NAME, LENS_RULE, PRIORITY_ORDER } from "@/lib/roadmap";
import { aiConfigured } from "@/lib/ai";
import { supabaseConfigured } from "@/lib/supabase";
import { addChecklistNode, saveUser, setArchived } from "@/lib/actions/lines";
import { Flash, Submit } from "@/components/client";
import { Card, Field, PageHeader, Pill } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requireArchitect();
  const [users, lines, constraints, sections, [counts]] = await Promise.all([
    listUsers(), listVisibleLines(user, true), listConstraints(), getSectionOptions(),
    sql`select (select count(*)::int from checklist_nodes where archived_at is null) as nodes, (select count(*)::int from roadmap_checklist_items) as roadmap_items`,
  ]);
  const roles = Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" />
      <Suspense><Flash /></Suspense>
      <div className="space-y-6">
        <Card>
          <h2 className="h2 mb-3">Users &amp; roles</h2>
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="py-2">
                <form action={saveUser} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_180px_auto]">
                  <input type="hidden" name="id" value={u.id} />
                  <input name="name" defaultValue={u.name} required aria-label="Name" className="input" />
                  <input name="email" type="email" defaultValue={u.email} required aria-label="E-mail" className="input" />
                  <select name="role" defaultValue={u.role} aria-label="Global role" className="input">{roles}</select>
                  <Submit className="btn-sm">Save</Submit>
                </form>
              </li>
            ))}
          </ul>
          <form action={saveUser} className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1.4fr_180px_auto]">
            <input name="name" required placeholder="Name" aria-label="New user name" className="input" />
            <input name="email" type="email" required placeholder="E-mail" aria-label="New user e-mail" className="input" />
            <select name="role" defaultValue="business_owner" aria-label="New user role" className="input">{roles}</select>
            <Submit className="btn-sm btn-primary">Add user</Submit>
          </form>
          <p className="mt-3 text-xs text-muted">
            Rola globalna „Growth Architect” daje pełny dostęp do wszystkich linii. Business Owner i Viewer widzą tylko linie, do których zostali dodani (Settings linii → Team members).
            Użytkownik łączy się ze swoim profilem przy pierwszym logowaniu potwierdzonym adresem e-mail.
          </p>
        </Card>

        <Card>
          <h2 className="h2 mb-3">Business lines</h2>
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-2 text-[13.5px]">
                <Link href={`/b/${l.slug}/team`} className="flex-1 font-medium hover:underline">{l.name}</Link>
                <span className="text-xs text-muted">{l.group_name} · owner: {l.owner_name ?? "—"}</span>
                {l.archived_at && <Pill tone="resolved">Archived</Pill>}
                <form action={setArchived}><input type="hidden" name="line" value={l.slug} /><input type="hidden" name="archived" value={l.archived_at ? "0" : "1"} /><Submit className="btn-sm btn-ghost">{l.archived_at ? "Restore" : "Archive"}</Submit></form>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Nową linię dodasz z Holding dashboard. Nazwę, ownera, Growth Architecta i zespół edytujesz w Settings danej linii.</p>
        </Card>

        <Card>
          <h2 className="h2">Constraint taxonomy</h2>
          <p className="mt-1 text-[13px] text-muted">Globalny template: {constraints.length} obszarów, {counts.nodes} elementów. Nowy element pojawia się we wszystkich liniach biznesowych bez utraty wcześniejszych review.</p>
          <form action={addChecklistNode} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_150px]">
            <Field label="Constraint"><select name="constraint_id" required className="input">{constraints.map((c) => <option key={c.id} value={c.id}>{c.number}. {c.name}</option>)}</select></Field>
            <Field label="Parent (section / subsection)"><select name="parent_id" className="input"><option value="">— directly under constraint —</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
            <Field label="Type"><select name="kind" className="input"><option value="item">Checklist item</option><option value="subsection">Subsection</option><option value="section">Section</option></select></Field>
            <Field label="Text" className="sm:col-span-2"><input name="title" required className="input" placeholder="Np. „follow-up po 90 dniach”" /></Field>
            <div className="flex items-end"><Submit className="btn-primary">Add to template</Submit></div>
          </form>
          <p className="mt-2 text-xs text-muted">Parent musi należeć do wybranego constraintu.</p>
        </Card>

        <Card id="framework">
          <div className="eyebrow">Framework info</div>
          <h2 className="mt-1 text-[16px] font-semibold tracking-tight">{FRAMEWORK_NAME}</h2>
          <p className="mt-2 text-[13.5px] text-ink-soft">{FRAMEWORK_DISCLAIMER}</p>
          <p className="mt-3 text-[13.5px] font-medium">{LENS_RULE}</p>
          <div className="eyebrow mt-3">Priority order</div>
          <ol className="mt-1 list-decimal pl-5 text-[13.5px] text-ink-soft">{PRIORITY_ORDER.map((p) => <li key={p}>{p}</li>)}</ol>
          <p className="mt-3 text-[13px] text-muted">
            AI nigdy nie mówi „Jesteś Stage 6, więc musisz robić X” bez sprawdzenia danych biznesu. Mówi: „Biznes wygląda na Stage 6. Typowym problemem tego etapu jest X.
            Wasze dane wskazują Y. Te dwa sygnały są zgodne / niezgodne.” Roadmapa: 10 etapów, {counts.roadmap_items} punktów graduation checklist.
          </p>
        </Card>

        <Card>
          <h2 className="h2 mb-2">System</h2>
          <ul className="space-y-1 text-[13.5px]">
            <li className="flex items-center gap-2"><Pill tone={aiConfigured() ? "healthy" : "watch"}>{aiConfigured() ? "Configured" : "Not configured"}</Pill> OpenAI Growth Assistant {aiConfigured() && <span className="text-muted">· model: {process.env.OPENAI_MODEL}</span>}</li>
            <li className="flex items-center gap-2"><Pill tone={supabaseConfigured() ? "healthy" : "watch"}>{supabaseConfigured() ? "Configured" : "Dev sign-in"}</Pill> Supabase Auth</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
