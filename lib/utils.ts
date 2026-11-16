export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}`;
  }
  const date = new Date(d);
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Warsaw" });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
  });
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export type Role = "growth_architect" | "business_owner" | "viewer";
export const ROLE_LABEL: Record<Role, string> = {
  growth_architect: "Growth Architect",
  business_owner: "Business Owner",
  viewer: "Viewer",
};

export const CONSTRAINT_STATUS: Record<string, { label: string; tone: string }> = {
  not_reviewed: { label: "Not reviewed", tone: "neutral" },
  healthy: { label: "Healthy", tone: "healthy" },
  watch: { label: "Watch", tone: "watch" },
  candidate: { label: "Candidate Constraint", tone: "candidate" },
  main: { label: "MAIN CONSTRAINT", tone: "critical" },
  resolved: { label: "Resolved / Previously constrained", tone: "resolved" },
};

export const ITEM_STATUS: Record<string, { label: string; tone: string }> = {
  not_reviewed: { label: "Not reviewed", tone: "neutral" },
  healthy: { label: "Healthy", tone: "healthy" },
  concern: { label: "Concern", tone: "watch" },
  candidate: { label: "Candidate constraint", tone: "candidate" },
};

export const HYPOTHESIS_STATUSES = ["idea", "backlog", "prioritized", "testing", "won", "lost", "inconclusive", "implemented"] as const;
export const ACTIVE_HYPOTHESIS_STATUSES = ["prioritized", "testing"];
export const MAX_ACTIVE = 3;

export function hypothesisScore(h: { impact: number; confidence: number; speed: number; effort: number }): number {
  return Math.round(((h.impact * h.confidence * h.speed) / Math.max(1, h.effort)) * 10) / 10;
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
