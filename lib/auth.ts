import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { sql } from "./db";
import { devAuthEnabled, supabaseConfigured, supabaseServer } from "./supabase";
import type { Role } from "./utils";

export type User = { id: string; email: string; name: string; role: Role };
export type Line = {
  id: string; slug: string; name: string; group_name: string; description: string;
  owner_id: string | null; growth_architect_id: string | null; headcount: number | null; archived_at: string | null;
};
export type Level = "view" | "contribute" | "manage";

export const DEV_COOKIE = "gaos_dev_user";

export const getSessionUser = cache(async (): Promise<User | null> => {
  await connection(); // always per-request — never prerender anything behind auth
  if (supabaseConfigured()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const au = data.user;
    if (!au?.email) return null;
    const email = au.email.toLowerCase();
    let [user] = await sql<User[]>`select id, email, name, role from users where auth_id = ${au.id}`;
    if (user) return user;
    // Link a pre-created profile by e-mail — only once the address is confirmed.
    if (au.email_confirmed_at) {
      [user] = await sql<User[]>`
        update users set auth_id = ${au.id} where lower(email) = ${email} and auth_id is null
        returning id, email, name, role`;
      if (user) return user;
    }
    const isAdmin = Boolean(au.email_confirmed_at) && email === (process.env.ADMIN_EMAIL ?? "").toLowerCase();
    [user] = await sql<User[]>`
      insert into users (auth_id, email, name, role)
      values (${au.id}, ${email}, ${email.split("@")[0]}, ${isAdmin ? "growth_architect" : "viewer"})
      on conflict (email) do nothing
      returning id, email, name, role`;
    return user ?? null;
  }
  if (devAuthEnabled()) {
    const id = (await cookies()).get(DEV_COOKIE)?.value;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
    const [user] = await sql<User[]>`select id, email, name, role from users where id = ${id}`;
    return user ?? null;
  }
  return null;
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireArchitect(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "growth_architect") notFound();
  return user;
}

export function allows(role: Role, level: Level): boolean {
  if (level === "view") return true;
  if (level === "contribute") return role !== "viewer";
  return role === "growth_architect";
}

/** Resolves a business line and the caller's effective role in it. 404 when there is no access. */
export const getLineAccess = cache(async (slug: string): Promise<{ user: User; line: Line; role: Role }> => {
  const user = await requireUser();
  const [line] = await sql<Line[]>`
    select id, slug, name, group_name, description, owner_id, growth_architect_id, headcount, archived_at
    from business_lines where slug = ${slug}`;
  if (!line) notFound();
  if (user.role === "growth_architect") return { user, line, role: "growth_architect" };
  const [m] = await sql<{ role: Role }[]>`
    select role from business_members where business_line_id = ${line.id} and user_id = ${user.id}`;
  if (!m) notFound();
  return { user, line, role: m.role };
});

export const listUsers = cache(async (): Promise<User[]> => sql<User[]>`select id, email, name, role from users order by name`);

export const listVisibleLines = cache(async (user: User, includeArchived = false) => {
  return sql<(Line & { owner_name: string | null })[]>`
    select b.id, b.slug, b.name, b.group_name, b.description, b.owner_id, b.growth_architect_id, b.headcount, b.archived_at,
           o.name as owner_name
    from business_lines b left join users o on o.id = b.owner_id
    where (${user.role === "growth_architect"} or exists (
             select 1 from business_members m where m.business_line_id = b.id and m.user_id = ${user.id}))
      and (${includeArchived} or b.archived_at is null)
    order by (b.group_name <> 'Pravna'), b.group_name, b.position, b.name`;
});
