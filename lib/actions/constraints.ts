"use server";
import { sql } from "../db";
import { back, fail, int, lineCtx, str, uuid } from "../action-utils";

const STATUSES = ["not_reviewed", "healthy", "watch", "candidate", "main", "resolved"];

export async function saveConstraintReview(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const constraintId = uuid(fd, "constraint_id");
  if (!constraintId) return fail("Brak constraintu.");
  const score = int(fd, "score");
  if (score != null && (score < 1 || score > 10)) return fail("Score musi być w zakresie 1–10.");
  await sql`
    insert into constraint_reviews (business_line_id, constraint_id, score, evidence, data_notes, owner_id, last_reviewed_at)
    values (${line.id}, ${constraintId}, ${score}, ${str(fd, "evidence")}, ${str(fd, "data_notes")}, ${uuid(fd, "owner_id")}, now())
    on conflict (business_line_id, constraint_id) do update set score = excluded.score, evidence = excluded.evidence,
      data_notes = excluded.data_notes, owner_id = excluded.owner_id, last_reviewed_at = now()`;
  return back({ notice: "Zapisano." });
}

/**
 * Changes a constraint's status. A business line can have only ONE active MAIN CONSTRAINT:
 * promoting a second one requires an explicit confirmation that also demotes the current one.
 */
export async function setConstraintStatus(fd: FormData) {
  const { line, user } = await lineCtx(fd, "manage");
  const constraintId = uuid(fd, "constraint_id");
  const status = str(fd, "status");
  const reason = str(fd, "reason");
  if (!constraintId || !STATUSES.includes(status)) return fail("Nieprawidłowy status.");

  const [current] = await sql`select status from constraint_reviews where business_line_id = ${line.id} and constraint_id = ${constraintId}`;
  const from = current?.status ?? "not_reviewed";
  if (from === status) return back();

  const [main] = await sql`select constraint_id from constraint_reviews where business_line_id = ${line.id} and status = 'main'`;
  if (status === "main" && main && str(fd, "confirm") !== "1") return back({ confirm_main: constraintId });

  const demoteTo = ["resolved", "watch", "candidate", "healthy"].includes(str(fd, "previous_to")) ? str(fd, "previous_to") : "resolved";
  await sql.begin(async (tx) => {
    if (status === "main" && main) {
      await tx`update constraint_reviews set status = ${demoteTo}, last_reviewed_at = now()
               where business_line_id = ${line.id} and constraint_id = ${main.constraint_id}`;
      await tx`insert into constraint_status_history (business_line_id, constraint_id, from_status, to_status, reason, changed_by)
               values (${line.id}, ${main.constraint_id}, 'main', ${demoteTo}, ${reason || "Zastąpiony nowym MAIN CONSTRAINT"}, ${user.id})`;
    }
    await tx`insert into constraint_reviews (business_line_id, constraint_id, status, last_reviewed_at)
             values (${line.id}, ${constraintId}, ${status}, now())
             on conflict (business_line_id, constraint_id) do update set status = excluded.status, last_reviewed_at = now()`;
    await tx`insert into constraint_status_history (business_line_id, constraint_id, from_status, to_status, reason, changed_by)
             values (${line.id}, ${constraintId}, ${from}, ${status}, ${reason}, ${user.id})`;
  });
  return back({ notice: status === "main" ? "Ustawiono MAIN CONSTRAINT. Otwórz dla niego Growth Cycle." : "Zmieniono status." });
}

export async function saveNodeReview(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const nodeId = uuid(fd, "node_id");
  const status = str(fd, "status") || "not_reviewed";
  if (!nodeId || !["not_reviewed", "healthy", "concern", "candidate"].includes(status)) return fail("Nieprawidłowe dane.");
  await sql`
    insert into checklist_reviews (business_line_id, node_id, status, checked, note, evidence, link, metric, owner_id, updated_by, updated_at)
    values (${line.id}, ${nodeId}, ${status}, ${fd.get("checked") === "on"}, ${str(fd, "note")}, ${str(fd, "evidence")},
            ${str(fd, "link")}, ${str(fd, "metric")}, ${uuid(fd, "owner_id")}, ${user.id}, now())
    on conflict (business_line_id, node_id) do update set status = excluded.status, checked = excluded.checked,
      note = excluded.note, evidence = excluded.evidence, link = excluded.link, metric = excluded.metric,
      owner_id = excluded.owner_id, updated_by = excluded.updated_by, updated_at = now()`;
  return back({ notice: "Zapisano." });
}

export async function addAttachment(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const targetId = uuid(fd, "target_id");
  const url = str(fd, "url");
  if (!targetId || !/^https?:\/\//i.test(url)) return fail("Podaj poprawny link (http/https).");
  await sql`insert into attachments (business_line_id, target_type, target_id, name, url, created_by)
            values (${line.id}, ${str(fd, "target_type") || "node"}, ${targetId}, ${str(fd, "name") || url}, ${url}, ${user.id})`;
  return back();
}

export async function deleteAttachment(fd: FormData) {
  const { line } = await lineCtx(fd, "contribute");
  const id = uuid(fd, "id");
  if (id) await sql`delete from attachments where id = ${id} and business_line_id = ${line.id}`;
  return back();
}
