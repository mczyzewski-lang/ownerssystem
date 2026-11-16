import { notFound } from "next/navigation";
import { getLineAccess, listUsers } from "@/lib/auth";
import { sql } from "@/lib/db";
import { saveMember, setArchived, updateLine } from "@/lib/actions/lines";
import { Submit } from "@/components/client";
import { Card, Field, UserSelect } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/utils";

export const metadata = { title: "Line settings" };

export default async function LineSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { line, role } = await getLineAccess(slug);
  if (role !== "growth_architect") notFound();
  const [users, members] = await Promise.all([
    listUsers(),
    sql<{ user_id: string; name: string; email: string; role: Role }[]>`
      select m.user_id, u.name, u.email, m.role from business_members m join users u on u.id = m.user_id where m.business_line_id = ${line.id} order by u.name`,
  ]);
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;
  const roles = Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <h2 className="h2 mb-3">Business line</h2>
        <form action={updateLine} className="grid gap-3 sm:grid-cols-2">
          {hiddenLine}
          <Field label="Name"><input name="name" required defaultValue={line.name} className="input" /></Field>
          <Field label="Group"><input name="group_name" defaultValue={line.group_name} className="input" /></Field>
          <Field label="Owner"><UserSelect name="owner_id" users={users} value={line.owner_id} /></Field>
          <Field label="Growth Architect"><UserSelect name="growth_architect_id" users={users} value={line.growth_architect_id} /></Field>
          <Field label="Headcount (roadmap signal)"><input name="headcount" type="number" min={0} defaultValue={line.headcount ?? ""} className="input" /></Field>
          <div />
          <Field label="Business description" className="sm:col-span-2"><textarea name="description" rows={4} defaultValue={line.description} className="input" /></Field>
          <div><Submit className="btn-primary">Save</Submit></div>
        </form>
      </Card>
      <Card>
        <h2 className="h2 mb-3">Team members</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">{m.name}</div><div className="truncate text-xs text-muted">{m.email}</div></div>
              <form action={saveMember} className="flex items-center gap-2">
                {hiddenLine}<input type="hidden" name="user_id" value={m.user_id} />
                <select name="role" defaultValue={m.role} aria-label={`Role of ${m.name}`} className="input !w-44">{roles}<option value="remove">Remove from line</option></select>
                <Submit className="btn-sm">Update</Submit>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveMember} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          {hiddenLine}
          <Field label="Add member"><UserSelect name="user_id" users={users.filter((u) => !members.some((m) => m.user_id === u.id))} placeholder="Select user…" /></Field>
          <Field label="Role"><select name="role" defaultValue="business_owner" className="input">{roles}</select></Field>
          <Submit>Add</Submit>
        </form>
        <p className="mt-2 text-xs text-muted">Nowych użytkowników dodasz w Settings → Users.</p>
      </Card>
      <Card>
        <h2 className="h2">{line.archived_at ? "Restore business line" : "Archive business line"}</h2>
        <p className="mt-1 text-[13px] text-muted">Archiwizacja ukrywa linię w nawigacji i dashboardzie. Cała historia zostaje zachowana.</p>
        <form action={setArchived} className="mt-3">{hiddenLine}<input type="hidden" name="archived" value={line.archived_at ? "0" : "1"} /><Submit>{line.archived_at ? "Restore" : "Archive"}</Submit></form>
      </Card>
    </div>
  );
}
