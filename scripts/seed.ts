import "./env";
import { parseTaxonomy } from "../db/seed/taxonomy";
import { ROADMAP_STAGES } from "../db/seed/roadmap";

// Idempotent. Templates (taxonomy, roadmap) are always upserted by stable key.
// Example business data is only inserted into an empty database.

const DEFAULT_FUNNEL = ["Traffic", "Lead", "Contact", "SQL", "Booked", "Show", "Decision", "Proforma", "Paid Customer"];

async function main() {
  const { sql } = await import("../lib/db");

  await sql.begin(async (tx) => {
    // ── taxonomy template
    const { constraints, nodes } = parseTaxonomy();
    const cId = new Map<string, string>();
    for (const c of constraints) {
      const [row] = await tx`
        insert into constraints (key, number, name, description, cross_cutting)
        values (${c.key}, ${c.number}, ${c.name}, ${c.description}, ${c.crossCutting})
        on conflict (key) do update set number = excluded.number, name = excluded.name,
          description = excluded.description, cross_cutting = excluded.cross_cutting
        returning id`;
      cId.set(c.key, row.id);
    }
    const nId = new Map<string, string>();
    for (const n of nodes) {
      const [row] = await tx`
        insert into checklist_nodes (key, constraint_id, parent_id, kind, code, title, description, position)
        values (${n.key}, ${cId.get(n.constraintKey)!}, ${n.parentKey ? nId.get(n.parentKey)! : null}, ${n.kind},
                ${n.code}, ${n.title}, ${n.description}, ${n.position})
        on conflict (key) do update set parent_id = excluded.parent_id, kind = excluded.kind, code = excluded.code,
          title = excluded.title, description = excluded.description, position = excluded.position
        returning id`;
      nId.set(n.key, row.id);
    }
    console.log(`taxonomy: ${constraints.length} constraints, ${nodes.length} checklist nodes`);

    // ── roadmap template
    let items = 0;
    for (const s of ROADMAP_STAGES) {
      await tx`
        insert into roadmap_stages ${tx({
          number: s.number, key: s.key, name: s.name, role: s.role, headcount_label: s.headcountLabel,
          headcount_min: s.headcountMin, headcount_max: s.headcountMax, main_constraint: s.mainConstraint,
          typical_constraint: s.typicalConstraint, typical_symptom: s.typicalSymptom ?? "", graduate_by: s.graduateBy,
          question: s.question, note: s.note ?? "", guidance: tx.json(s.guidance), strong_signals: tx.json(s.strongSignals ?? []),
          primary_constraints: s.primaryConstraints, secondary_constraints: s.secondaryConstraints,
          mismatch_question: s.mismatchQuestion,
        })}
        on conflict (number) do update set key = excluded.key, name = excluded.name, role = excluded.role,
          headcount_label = excluded.headcount_label, headcount_min = excluded.headcount_min, headcount_max = excluded.headcount_max,
          main_constraint = excluded.main_constraint, typical_constraint = excluded.typical_constraint,
          typical_symptom = excluded.typical_symptom, graduate_by = excluded.graduate_by, question = excluded.question,
          note = excluded.note, guidance = excluded.guidance, strong_signals = excluded.strong_signals,
          primary_constraints = excluded.primary_constraints, secondary_constraints = excluded.secondary_constraints,
          mismatch_question = excluded.mismatch_question`;
      for (const [i, text] of s.checklist.entries()) {
        await tx`
          insert into roadmap_checklist_items (key, stage_number, text, position)
          values (${`${s.key}/${i + 1}`}, ${s.number}, ${text}, ${i})
          on conflict (key) do update set text = excluded.text, position = excluded.position, stage_number = excluded.stage_number`;
        items++;
      }
    }
    console.log(`roadmap: ${ROADMAP_STAGES.length} stages, ${items} graduation checklist items`);

    // ── example business data (only once)
    const [{ count }] = await tx`select count(*)::int as count from business_lines`;
    if (count > 0) {
      console.log("business data already present — skipped");
      return;
    }

    const adminEmail = (process.env.ADMIN_EMAIL ?? "architect@example.com").toLowerCase();
    const user = async (email: string, name: string, role: string) =>
      (await tx`insert into users (email, name, role) values (${email}, ${name}, ${role})
                on conflict (email) do update set role = excluded.role returning id`)[0].id as string;
    const architect = await user(adminEmail, "Growth Architect", "growth_architect");
    const grzegorz = await user("grzegorz@example.com", "Grzegorz", "business_owner");
    const ryszard = await user("ryszard@example.com", "Ryszard", "business_owner");

    const lines: [string, string, string, string | null][] = [
      ["znaki-towarowe", "Znaki Towarowe", "Pravna", ryszard],
      ["upadlosc-konsumencka", "Upadłość Konsumencka", "Pravna", grzegorz],
      ["restrukturyzacja", "Restrukturyzacja", "Pravna", null],
      ["sankcja-kredytu-darmowego", "Sankcja Kredytu Darmowego", "Pravna", null],
      ["ip-box", "IP BOX", "Pravna", null],
      ["nowy-etap", "Nowy-Etap", "Osobne spółki / marki", null],
      ["risify", "Risify", "Osobne spółki / marki", null],
      ["budaro", "Budaro", "Osobne spółki / marki", null],
    ];
    const lineId = new Map<string, string>();
    for (const [i, [slug, name, group, owner]] of lines.entries()) {
      const [bl] = await tx`
        insert into business_lines (slug, name, group_name, owner_id, growth_architect_id, position)
        values (${slug}, ${name}, ${group}, ${owner}, ${architect}, ${i}) returning id`;
      lineId.set(slug, bl.id);
      await tx`insert into business_members (business_line_id, user_id, role) values (${bl.id}, ${architect}, 'growth_architect')`;
      if (owner) await tx`insert into business_members (business_line_id, user_id, role) values (${bl.id}, ${owner}, 'business_owner')`;
      const [f] = await tx`insert into funnel_definitions (business_line_id) values (${bl.id}) returning id`;
      const steps = slug === "risify" ? ["Traffic", "Quiz", "Payment", "Session 1", "Session 2", "Session 4", "Session 8"] : DEFAULT_FUNNEL;
      for (const [p, s] of steps.entries()) await tx`insert into funnel_steps (funnel_id, name, position) values (${f.id}, ${s}, ${p})`;
    }

    const sales = cId.get("sales_conversion")!;
    const seedCycle = async (slug: string, c: Record<string, unknown>, hypotheses: string[]) => {
      const bl = lineId.get(slug)!;
      await tx`insert into constraint_reviews (business_line_id, constraint_id, status, last_reviewed_at)
               values (${bl}, ${sales}, 'main', now())`;
      await tx`insert into constraint_status_history (business_line_id, constraint_id, from_status, to_status, reason, changed_by)
               values (${bl}, ${sales}, 'not_reviewed', 'main', 'Seed data', ${architect})`;
      const [cycle] = await tx`insert into growth_cycles ${tx({ business_line_id: bl, constraint_id: sales, status: "active", ...c })} returning id`;
      for (const h of hypotheses)
        await tx`insert into hypotheses (business_line_id, constraint_id, statement, status, created_by)
                 values (${bl}, ${sales}, ${h}, 'backlog', ${architect})`;
      return cycle.id as string;
    };

    await seedCycle(
      "upadlosc-konsumencka",
      {
        name: "Growth Cycle 01 — Sales Conversion",
        start_date: "2026-11-01",
        end_date: "2027-01-31",
        primary_metric: "Show → Paid Customer",
        baseline: "12.7%",
        target: "18%",
        economic_upside: "~132 000 PLN / month",
        confidence: "medium",
        owner_id: grzegorz,
        root_causes: "- różnice kompetencyjne między handlowcami\n- słaby follow-up\n- zły mix ICP / jakości leadów",
        condition_of_victory: "17%+ przez 4 tygodnie bez pogorszenia refund rate.",
      },
      [
        "Różnice kompetencyjne między handlowcami: replikacja praktyk top performera podniesie Show → Paid całego zespołu.",
        "Słaby follow-up: ustrukturyzowana sekwencja follow-up (24h / 48h / 7d) odzyska część niezdecydowanych klientów.",
        "Zły mix ICP / jakości leadów: lepsza kwalifikacja przed rozmową podniesie Show → Paid.",
      ],
    );
    await tx`insert into decisions (business_line_id, decision_date, decision, why, owner_id, created_by)
             values (${lineId.get("upadlosc-konsumencka")!}, '2026-11-12',
                     'Nie skalujemy Lead Gen. Najpierw pracujemy nad Show → Paid.',
                     '12.7% conversion, target 18%.', ${grzegorz}, ${architect})`;

    await seedCycle(
      "nowy-etap",
      {
        name: "Growth Cycle 01 — Sales Conversion",
        primary_metric: "Show → Win",
        baseline: "24%",
        target: "32%",
        confidence: "medium",
      },
      [],
    );

    for (const slug of ["upadlosc-konsumencka", "nowy-etap"])
      await tx`insert into stage_assessments (business_line_id, stage_number, source, status, reason, evidence, author_id)
               values (${lineId.get(slug)!}, 6, 'manual', 'accepted',
                       'Seed example — do weryfikacji przyciskiem ASSESS HORMOZI STAGE.',
                       'Acquisition, sprzedaż i delivery istnieją; problem leży w efektywności (conversion).', ${architect})`;

    console.log(`business data: ${lines.length} business lines, 3 users (Growth Architect = ${adminEmail})`);
  });
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
