"use server";
import { sql } from "../db";
import { back, fail, int, lineCtx, opt, str, uuid } from "../action-utils";

export async function saveRoadmapItem(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const itemId = uuid(fd, "item_id");
  const status = str(fd, "status");
  if (!itemId || !["not_reviewed", "pass", "fail"].includes(status)) return fail("Nieprawidłowe dane.");
  await sql`
    insert into roadmap_checklist_reviews (business_line_id, item_id, status, comment, evidence, metric, owner_id, updated_by, updated_at)
    values (${line.id}, ${itemId}, ${status}, ${str(fd, "comment")}, ${str(fd, "evidence")}, ${str(fd, "metric")},
            ${uuid(fd, "owner_id")}, ${user.id}, now())
    on conflict (business_line_id, item_id) do update set status = excluded.status, comment = excluded.comment,
      evidence = excluded.evidence, metric = excluded.metric, owner_id = excluded.owner_id,
      updated_by = excluded.updated_by, updated_at = now()`;
  return back({ open: itemId }, "checklist");
}

const stageNumber = (fd: FormData, k = "stage_number"): number | null => {
  const n = int(fd, k);
  return n != null && n >= 0 && n <= 9 ? n : null;
};

/** Manual stage decision. Every change is kept in the roadmap history with reason, evidence and author. */
export async function setStageManually(fd: FormData) {
  const { line, user } = await lineCtx(fd, "manage");
  const stage = stageNumber(fd);
  const reason = str(fd, "reason");
  if (stage == null) return fail("Wybierz etap 0–9.");
  if (!reason) return fail("Każda zmiana etapu wymaga uzasadnienia (reason).");
  await sql`insert into stage_assessments (business_line_id, stage_number, assessed_on, source, status, reason, evidence, author_id)
            values (${line.id}, ${stage}, ${opt(fd, "assessed_on") ?? new Date().toISOString().slice(0, 10)}, 'manual', 'accepted',
                    ${reason}, ${str(fd, "evidence")}, ${user.id})`;
  return back({ notice: "Zapisano etap w historii roadmapy." }, "history");
}

/** AI only proposes. A Growth Architect accepts, overrides (different stage + reason) or rejects the proposal. */
export async function resolveAssessment(fd: FormData) {
  const { line, user } = await lineCtx(fd, "manage");
  const id = uuid(fd, "id");
  const decision = str(fd, "decision");
  const [a] = await sql`select id, stage_number, reason from stage_assessments
                        where id = ${id} and business_line_id = ${line.id} and status = 'proposed'`;
  if (!a) return fail("Ta propozycja AI została już rozpatrzona.");
  if (decision === "reject") {
    await sql`update stage_assessments set status = 'rejected', author_id = ${user.id},
              evidence = ${str(fd, "reason") ? "Rejected: " + str(fd, "reason") : "Rejected"} where id = ${id}`;
    return back({ notice: "Odrzucono propozycję AI — zostaje w historii." }, "history");
  }
  const stage = stageNumber(fd) ?? a.stage_number;
  const override = stage !== a.stage_number;
  const reason = str(fd, "reason");
  if (override && !reason) return fail("Manual override wymaga uzasadnienia: dlaczego etap jest inny niż zaproponowało AI?");
  await sql`update stage_assessments set status = 'accepted', stage_number = ${stage}, manual_override = ${override},
              reason = ${override ? reason : a.reason}, evidence = ${str(fd, "evidence") || (override ? "" : reason)},
              author_id = ${user.id}, assessed_on = current_date
            where id = ${id}`;
  return back({ notice: override ? "Zapisano etap z manual override." : "Zaakceptowano ocenę AI." }, "history");
}
