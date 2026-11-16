"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Submit({ children, className, pendingText, confirm, name, value }: { children: ReactNode; className?: string; pendingText?: string; confirm?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn("btn", className)}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? (pendingText ?? "…") : children}
    </button>
  );
}

/** Shows ?error= / ?notice= produced by server actions. */
export function Flash() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = sp.get("error");
  const notice = sp.get("notice");
  if (!error && !notice) return null;
  const dismiss = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete("error");
    next.delete("notice");
    router.replace(pathname + (next.size ? `?${next}` : ""), { scroll: false });
  };
  return (
    <div role={error ? "alert" : "status"} className={cn("mb-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-[13px]",
      error ? "border-critical/30 bg-critical-soft text-critical" : "border-line-strong bg-sunken text-ink-soft")}>
      <span>{error ?? notice}</span>
      <button type="button" onClick={dismiss} className="shrink-0 text-xs underline underline-offset-2">Zamknij</button>
    </div>
  );
}

export function NavLink({ href, children, exact, className, activeClassName }: { href: string; children: ReactNode; exact?: boolean; className?: string; activeClassName?: string }) {
  const pathname = usePathname();
  const path = href.split("?")[0];
  const active = exact ? pathname === path : pathname === path || pathname.startsWith(path + "/");
  return <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>{children}</Link>;
}
