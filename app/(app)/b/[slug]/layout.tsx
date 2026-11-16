import { Suspense } from "react";
import { getLineAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Flash, NavLink } from "@/components/client";
import { Pill } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/utils";

export default async function LineLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { line, role } = await getLineAccess(slug);
  const [main] = await sql`select c.name from constraint_reviews r join constraints c on c.id = r.constraint_id
                           where r.business_line_id = ${line.id} and r.status = 'main'`;
  const base = `/b/${line.slug}`;
  const ga = role === "growth_architect";
  const tabs: [string, string, boolean?][] = [
    ...(ga ? ([[base, "Overview", true]] as [string, string, boolean][]) : ([[`${base}/workspace`, "Workspace"], [`${base}?full=1`, "Full diagnostic", true]] as [string, string, boolean?][])),
    [`${base}/review`, "Review"],
    [`${base}/hypotheses`, "Hypotheses"],
    [`${base}/cycles`, "Growth Cycles"],
    [`${base}/funnel`, "Funnel"],
    [`${base}/data`, "Data Room"],
    [`${base}/roadmap`, "Scaling Roadmap"],
    [`${base}/ai`, "Growth AI"],
    [`${base}/decisions`, "Decisions"],
    ...(ga ? ([[`${base}/workspace`, "Owner view"], [`${base}/team`, "Settings"]] as [string, string][]) : []),
  ];
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="eyebrow">{line.group_name}</span>
        {line.archived_at && <Pill tone="resolved">Archived</Pill>}
        {!ga && <Pill>{ROLE_LABEL[role]}</Pill>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">{line.name}</h1>
        {main ? <Pill tone="critical">Main constraint · {main.name}</Pill> : <Pill>Diagnosis</Pill>}
      </div>
      <nav aria-label="Business line" className="-mx-4 mb-6 mt-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-5">
          {tabs.map(([href, label, exact]) => (
            <NavLink key={href + label} href={href} exact={exact}
              className="-mb-px whitespace-nowrap border-b-2 border-transparent pb-2.5 text-[13px] text-muted hover:text-ink"
              activeClassName="!border-ink font-medium !text-ink">{label}</NavLink>
          ))}
        </div>
      </nav>
      <Suspense><Flash /></Suspense>
      {children}
    </div>
  );
}
