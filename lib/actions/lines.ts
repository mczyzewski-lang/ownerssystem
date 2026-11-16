"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "../db";
import { requireArchitect } from "../auth";
import { back, fail, int, lineCtx, str, uuid } from "../action-utils";
import { slugify } from "../utils";

const ROLES = ["growth_architect", "business_owner", "viewer"];
const DEFAULT_FUNNEL = ["Traffic", "Lead", "Contact", "SQL", "Booked", "Show", "Decision", "Proforma", "Paid Customer"];

export async function createLine(fd: FormData) {
  const user = await requireArchitect();
  const name = str(fd, "name");
  if (!name) return fail("Podaj nazwę linii biznesowej.");
  let slug = slugify(name) || "line";
  const taken = new Set((await sql`select slug from business_lines where slug like ${slug + "%"}`).map((r) => r.slug));
  for (let i = 2; taken.has(slug); i++) slug = `${slugify(name)}-${i}`;
  const owner = uuid(fd, "owner_id");
  await sql.begin(async (tx) => {
    const [{ pos }] = await tx`select coalesce(max(position), 0) + 1 as pos from business_lines`;
    const [bl] = await tx`
      insert into business_lines (slug, name, group_name, owner_id, growth_architect_id, position)
      values (${slug}, ${name}, ${str(fd, "group_name") || "Osobne spółki / marki"}, ${owner}, ${user.id}, ${pos}) returning id`;
    await tx`insert into business_members (business_line_id, user_id, role) values (${bl.id}, ${user.id}, 'growth_architect')`;
    if (owner && owner !== user.id)
      await tx`insert into business_members (business_line_id, user_id, role) values (${bl.id}, ${owner}, 'business_owner')`;
    const [f] = await tx`insert into funnel_definitions (business_line_id) values (${bl.id}) returning id`;
    for (const [p, s] of DEFAULT_FUNNEL.entries()) await tx`insert into funnel_steps (funnel_id, name, position) values (${f.id}, ${s}, ${p})`;
  });
  revalidatePath("/", "layout");
  redirect(`/b/${slug}`);
}

export async function updateLine(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const name = str(fd, "name");
  if (!name) return fail("Nazwa nie może być pusta.");
  const owner = uuid(fd, "owner_id");
  const ga = uuid(fd, "growth_architect_id");
  await sql.begin(async (tx) => {
    await tx`update business_lines set name = ${name}, group_name = ${str(fd, "group_name") || line.group_name},
             description = ${str(fd, "description")}, owner_id = ${owner}, growth_architect_id = ${ga}, headcount = ${int(fd, "headcount")}
             where id = ${line.id}`;
    if (owner) await tx`insert into business_members (business_line_id, user_id, role) values (${line.id}, ${owner}, 'business_owner') on conflict do nothing`;
    if (ga) await tx`insert into business_members (business_line_id, user_id, role) values (${line.id}, ${ga}, 'growth_architect')
                     on conflict (business_line_id, user_id) do update set role = 'growth_architect'`;
  });
  return back({ notice: "Zapisano." });
}

export async function setHeadcount(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  await sql`update business_lines set headcount = ${int(fd, "headcount")} where id = ${line.id}`;
  return back();
}

export async function setArchived(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  await sql`update business_lines set archived_at = ${str(fd, "archived") === "1" ? sql`now()` : null} where id = ${line.id}`;
  return back();
}

export async function saveMember(fd: FormData) {
  const { line } = await lineCtx(fd, "manage");
  const userId = uuid(fd, "user_id");
  const role = str(fd, "role");
  if (!userId) return fail("Wybierz użytkownika.");
  if (role === "remove") await sql`delete from business_members where business_line_id = ${line.id} and user_id = ${userId}`;
  else if (ROLES.includes(role))
    await sql`insert into business_members (business_line_id, user_id, role) values (${line.id}, ${userId}, ${role})
              on conflict (business_line_id, user_id) do update set role = excluded.role`;
  return back();
}

export async function saveUser(fd: FormData) {
  await requireArchitect();
  const id = uuid(fd, "id");
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role");
  if (!email.includes("@") || !name || !ROLES.includes(role)) return fail("Podaj imię, poprawny e-mail i rolę.");
  try {
    if (id) await sql`update users set email = ${email}, name = ${name}, role = ${role} where id = ${id}`;
    else await sql`insert into users (email, name, role) values (${email}, ${name}, ${role})`;
  } catch {
    return fail("Użytkownik z takim adresem e-mail już istnieje.");
  }
  return back({ notice: "Zapisano użytkownika." });
}

/** Extends the GLOBAL checklist template — the new node appears in every business line. */
export async function addChecklistNode(fd: FormData) {
  await requireArchitect();
  const constraintId = uuid(fd, "constraint_id");
  const parentId = uuid(fd, "parent_id");
  const title = str(fd, "title");
  if (!constraintId || !title) return fail("Wybierz constraint i podaj treść elementu.");
  let parent: { id: string; key: string; kind: string; constraint_id: string } | undefined;
  if (parentId) {
    [parent] = await sql<{ id: string; key: string; kind: string; constraint_id: string }[]>`
      select id, key, kind, constraint_id from checklist_nodes where id = ${parentId}`;
    if (!parent || parent.constraint_id !== constraintId || parent.kind === "item") return fail("Nieprawidłowy element nadrzędny.");
  }
  const [c] = await sql`select key from constraints where id = ${constraintId}`;
  const requested = str(fd, "kind");
  const kind = !parent ? (requested === "section" ? "section" : "item") : requested === "subsection" && parent.kind === "section" ? "subsection" : "item";
  const key = `${parent?.key ?? c.key}/${slugify(title) || "x"}-${Date.now().toString(36)}`;
  await sql`insert into checklist_nodes (key, constraint_id, parent_id, kind, title, position)
            values (${key}, ${constraintId}, ${parent?.id ?? null}, ${kind}, ${title},
                    (select coalesce(max(position), -1) + 1 from checklist_nodes where constraint_id = ${constraintId}
                       and parent_id is not distinct from ${parent?.id ?? null}))`;
  return back({ notice: "Dodano element do globalnej taksonomii — jest widoczny we wszystkich liniach." });
}
