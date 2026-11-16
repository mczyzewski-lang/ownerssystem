"use server";
import { sql } from "../db";
import { back, fail, lineCtx, str, uuid } from "../action-utils";

const TARGETS = ["business_line", "constraint", "node", "hypothesis", "experiment", "cycle", "decision", "roadmap_item"];

async function mentionsIn(body: string): Promise<string[]> {
  if (!body.includes("@")) return [];
  const users = await sql<{ id: string; name: string }[]>`select id, name from users`;
  const lower = body.toLowerCase();
  return users.filter((u) => lower.includes("@" + u.name.toLowerCase())).map((u) => u.id);
}

export async function addComment(fd: FormData) {
  const { line, user, role } = await lineCtx(fd, "contribute");
  const targetType = str(fd, "target_type");
  const targetId = uuid(fd, "target_id");
  const body = str(fd, "body");
  if (!TARGETS.includes(targetType) || !targetId) return fail("Nieprawidłowy cel komentarza.");
  if (!body) return fail("Komentarz nie może być pusty.");
  let kind = str(fd, "kind");
  if (!["question", "data_request"].includes(kind) || role !== "growth_architect") kind = "comment";
  await sql`insert into comments (business_line_id, target_type, target_id, parent_id, kind, author_id, body, mentions)
            values (${line.id}, ${targetType}, ${targetId}, ${uuid(fd, "parent_id")}, ${kind}, ${user.id}, ${body}, ${await mentionsIn(body)})`;
  return back();
}

export async function editComment(fd: FormData) {
  const { line, user } = await lineCtx(fd, "contribute");
  const id = uuid(fd, "id");
  const body = str(fd, "body");
  if (!id || !body) return fail("Komentarz nie może być pusty.");
  const [c] = await sql`select body, author_id from comments where id = ${id} and business_line_id = ${line.id}`;
  if (!c) return fail("Nie znaleziono komentarza.");
  if (c.author_id !== user.id) return fail("Edytować komentarz może tylko jego autor.");
  if (c.body !== body)
    await sql.begin(async (tx) => {
      await tx`insert into comment_edits (comment_id, body, edited_by) values (${id}, ${c.body}, ${user.id})`;
      await tx`update comments set body = ${body}, mentions = ${await mentionsIn(body)}, edited_at = now() where id = ${id}`;
    });
  return back();
}

export async function setCommentStatus(fd: FormData) {
  const { line } = await lineCtx(fd, "contribute");
  const id = uuid(fd, "id");
  const status = str(fd, "status") === "resolved" ? "resolved" : "open";
  if (id) await sql`update comments set status = ${status} where id = ${id} and business_line_id = ${line.id}`;
  return back();
}
