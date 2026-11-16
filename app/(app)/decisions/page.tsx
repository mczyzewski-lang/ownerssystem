import { listUsers, listVisibleLines, requireUser } from "@/lib/auth";
import { DecisionLog } from "@/components/decision-log";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Decision log" };

export default async function Decisions() {
  const user = await requireUser();
  const lines = await listVisibleLines(user, true);
  return (
    <div>
      <PageHeader eyebrow="Cross-business view" title="Decision log" description="Decyzje ze wszystkich linii biznesowych. Nowe decyzje dodawaj w zakładce Decisions danej linii." />
      <DecisionLog lineIds={lines.map((l) => l.id)} users={await listUsers()} />
    </div>
  );
}
