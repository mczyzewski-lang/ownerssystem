import { getLineAccess, listUsers } from "@/lib/auth";
import { DecisionLog } from "@/components/decision-log";

export const metadata = { title: "Decisions" };

export default async function LineDecisions({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { line, role } = await getLineAccess(slug);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight">Decision Log</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">Każda ważna decyzja: co, dlaczego, na jakich dowodach, czego oczekujemy i kiedy sprawdzamy wynik.</p>
      </div>
      <DecisionLog lineIds={[line.id]} editable={role === "growth_architect" ? { slug: line.slug } : undefined} users={await listUsers()} />
    </div>
  );
}
