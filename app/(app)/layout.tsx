import Link from "next/link";
import { Suspense } from "react";
import { listVisibleLines, requireUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { NavLink } from "@/components/client";
import { ROLE_LABEL } from "@/lib/utils";

const item = "block truncate rounded-md px-2.5 py-1.5 text-[13px] text-ink-soft hover:bg-sunken";
const active = "bg-sunken font-medium text-ink";

async function Nav() {
  const user = await requireUser();
  const lines = await listVisibleLines(user);
  const groups = [...new Set(lines.map((l) => l.group_name))];
  return (
    <nav className="flex h-full flex-col gap-6">
      <form action="/search" className="px-1">
        <input name="q" type="search" placeholder="Search…" aria-label="Global search" className="input bg-surface" />
      </form>
      <div className="space-y-0.5">
        <NavLink href="/" exact className={item} activeClassName={active}>Holding dashboard</NavLink>
        <NavLink href="/decisions" className={item} activeClassName={active}>Decision log</NavLink>
        {user.role === "growth_architect" && <NavLink href="/settings" className={item} activeClassName={active}>Settings</NavLink>}
      </div>
      {groups.map((g) => (
        <div key={g}>
          <div className="eyebrow mb-1.5 px-2.5">{g}</div>
          <div className="space-y-0.5">
            {lines.filter((l) => l.group_name === g).map((l) => (
              <NavLink key={l.id} href={`/b/${l.slug}`} className={item} activeClassName={active}>{l.name}</NavLink>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-auto border-t border-line px-2.5 pt-4">
        <div className="truncate text-[13px] font-medium">{user.name}</div>
        <div className="text-xs text-muted">{ROLE_LABEL[user.role]}</div>
        <form action={signOut}><button className="mt-2 text-xs text-muted underline underline-offset-2 hover:text-ink">Sign out</button></form>
      </div>
    </nav>
  );
}

const Brand = () => (
  <Link href="/" className="flex items-center gap-2 px-2.5 text-[13px] font-semibold tracking-tight">
    <span className="grid h-5 w-5 place-items-center rounded bg-ink text-[10px] font-bold text-paper">G</span>
    Growth Architect OS
  </Link>
);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-3 py-5 lg:flex">
        <Brand />
        <Suspense><Nav /></Suspense>
      </aside>
      <details className="border-b border-line bg-surface lg:hidden">
        <summary className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="grid h-5 w-5 place-items-center rounded bg-ink text-[10px] font-bold text-paper">G</span>Growth Architect OS</span>
          <span className="btn btn-sm">Menu</span>
        </summary>
        <div className="px-3 pb-4"><Suspense><Nav /></Suspense></div>
      </details>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
