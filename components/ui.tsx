import Link from "next/link";
import type { ReactNode } from "react";
import { cn, CONSTRAINT_STATUS, ITEM_STATUS } from "@/lib/utils";

export function Pill({ tone = "neutral", children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={cn("pill", tone !== "neutral" && `pill-${tone}`, className)}>{children}</span>;
}

export function ConstraintStatusPill({ status }: { status: string }) {
  const s = CONSTRAINT_STATUS[status] ?? CONSTRAINT_STATUS.not_reviewed;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function ItemStatusPill({ status }: { status: string }) {
  const s = ITEM_STATUS[status] ?? ITEM_STATUS.not_reviewed;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const DOT: Record<string, string> = {
  not_reviewed: "border border-line-strong bg-transparent",
  healthy: "bg-healthy", pass: "bg-healthy",
  watch: "bg-watch", concern: "bg-watch",
  candidate: "bg-watch ring-2 ring-watch/30",
  main: "bg-critical", fail: "bg-critical",
  resolved: "bg-line-strong",
};
export function Dot({ status }: { status: string }) {
  return <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", DOT[status] ?? DOT.not_reviewed)} />;
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("card p-5", className)}>{children}</section>;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 text-[14px] text-ink">{children || "—"}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">{children}</p>;
}

export function PageHeader({ title, eyebrow, children, description }: { title: string; eyebrow?: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function UserSelect({ name, users, value, placeholder = "—" }: { name: string; users: { id: string; name: string }[]; value?: string | null; placeholder?: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="input">
      <option value="">{placeholder}</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={cn("underline decoration-line-strong underline-offset-2 hover:decoration-ink", className)}>{children}</Link>;
}
