import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { devAuthEnabled, supabaseConfigured } from "@/lib/supabase";
import { devSignIn, signIn, signUp } from "@/lib/actions/auth";
import { Submit } from "@/components/client";
import { Field } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/utils";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { error, notice } = await searchParams;
  const dev = devAuthEnabled();
  const users = dev ? await sql<{ id: string; name: string; role: Role }[]>`select id, name, role from users order by (role = 'growth_architect') desc, name` : [];
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-8 w-8 place-items-center rounded-lg bg-ink text-sm font-bold text-paper">G</div>
          <h1 className="h1">Growth Architect OS</h1>
          <p className="mt-1 text-[13px] text-muted">System do diagnozowania i usuwania ograniczeń wzrostu.</p>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-critical/30 bg-critical-soft px-3 py-2 text-[13px] text-critical">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-line-strong bg-sunken px-3 py-2 text-[13px]">{notice}</p>}
        <div className="card p-5">
          {supabaseConfigured() ? (
            <form className="space-y-3">
              <Field label="E-mail"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
              <Field label="Password"><input name="password" type="password" required minLength={8} autoComplete="current-password" className="input" /></Field>
              <div className="flex gap-2 pt-1">
                <button formAction={signIn} className="btn btn-primary flex-1">Sign in</button>
                <button formAction={signUp} className="btn flex-1">Create account</button>
              </div>
              <p className="text-xs text-muted">Nowe konto otrzymuje rolę Viewer, dopóki Growth Architect nie nada uprawnień.</p>
            </form>
          ) : dev ? (
            <form action={devSignIn} className="space-y-3">
              <p className="text-xs text-muted">Tryb deweloperski — Supabase Auth nie jest skonfigurowane. Wybierz użytkownika z seeda.</p>
              <Field label="Sign in as">
                <select name="user" className="input">
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABEL[u.role]}</option>)}
                </select>
              </Field>
              <Submit className="btn-primary w-full">Continue</Submit>
            </form>
          ) : (
            <p className="text-[13px] text-muted">Logowanie nie jest skonfigurowane. Ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
          )}
        </div>
      </div>
    </main>
  );
}
