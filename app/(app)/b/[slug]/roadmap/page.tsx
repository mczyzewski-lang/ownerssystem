import Link from "next/link";
import { getLineAccess, listUsers } from "@/lib/auth";
import { getRoadmapState, getStageHistory } from "@/lib/roadmap-data";
import { FRAMEWORK_NAME, LENS_RULE, stageLabel } from "@/lib/roadmap";
import { AI_ACTIONS, aiConfigured } from "@/lib/ai";
import { resolveAssessment, saveRoadmapItem, setStageManually } from "@/lib/actions/roadmap";
import { setHeadcount } from "@/lib/actions/lines";
import { runAiAction } from "@/lib/actions/ai";
import { Submit } from "@/components/client";
import { Card, Dot, Empty, Fact, Field, Pill, TextLink, UserSelect } from "@/components/ui";
import { AlignmentPill, DebtPill, StageAxis } from "@/components/roadmap";
import { cn, fmtDate } from "@/lib/utils";

export const metadata = { title: "Scaling Roadmap" };
export const maxDuration = 120;

const ITEM_LABEL: Record<string, string> = { not_reviewed: "Not reviewed", pass: "Pass", fail: "Fail" };

export default async function RoadmapPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ stage?: string; open?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { line, role } = await getLineAccess(slug);
  const [state, history, users] = await Promise.all([getRoadmapState(line), getStageHistory(line.id), listUsers()]);
  const { stages, current, alignment, debt, observed } = state;
  const ga = role === "growth_architect";
  const canEdit = role !== "viewer";
  const ai = aiConfigured();
  const base = `/b/${line.slug}/roadmap`;

  const requested = Number(sp.stage);
  const selected = stages.find((s) => s.number === (sp.stage != null && Number.isInteger(requested) ? requested : (current?.number ?? 0))) ?? stages[0];
  const items = state.items.filter((i) => i.stage_number === selected.number);
  const passed = items.filter((i) => i.status === "pass").length;
  const proposal = history.find((h) => h.status === "proposed");
  const next = current ? stages.find((s) => s.number === current.number + 1) : null;
  const hiddenLine = <input type="hidden" name="line" value={line.slug} />;

  const aiButton = (action: string, primary?: boolean) => (
    <form key={action} action={runAiAction}>
      {hiddenLine}<input type="hidden" name="action" value={action} />
      <Submit className={cn(primary && "btn-primary")} pendingText="AI analizuje…">{action === "assess_stage" ? "ASSESS HORMOZI STAGE" : AI_ACTIONS[action].label}</Submit>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{FRAMEWORK_NAME}</div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-tight">Scaling Roadmap</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Osobna soczewka diagnostyczna obok Constraint Engine. {LENS_RULE} Etap nie ustawia Primary Constraint — pokazujemy oba sygnały obok siebie.
          </p>
        </div>
        {ga && (
          <form action={setHeadcount} className="flex items-end gap-2">
            {hiddenLine}
            <Field label="Headcount (signal only)"><input name="headcount" type="number" min={0} defaultValue={line.headcount ?? ""} className="input !w-28" /></Field>
            <Submit>Save</Submit>
          </form>
        )}
      </div>

      <Card className="!p-4">
        <StageAxis stages={stages} current={current?.number ?? null} selected={selected.number} headcountStage={state.headcountStage}
          lowestUnresolved={debt.lowestUnresolved} href={(n) => `${base}?stage=${n}#stage`} />
      </Card>

      {/* ── two diagnostics side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="eyebrow">1 · Observed Primary Constraint</div>
          <div className="mt-1 text-[11px] text-muted">wynika z danych tej linii biznesowej (Constraint Engine)</div>
          <div className={cn("mt-3 text-[20px] font-semibold tracking-tight", observed ? "text-critical" : "text-muted")}>{observed?.name ?? "Not diagnosed yet"}</div>
          <p className="mt-2 text-[13px] text-muted">
            {observed ? <>Źródło prawdy: economics, funnel i root cause analysis. <TextLink href={`/b/${line.slug}`}>Constraint Map</TextLink></> : <>Ustaw MAIN CONSTRAINT w <TextLink href={`/b/${line.slug}`}>Constraint Map</TextLink>.</>}
          </p>
        </Card>
        <Card>
          <div className="eyebrow">2 · Hormozi Stage Constraint</div>
          <div className="mt-1 text-[11px] text-muted">typowe ograniczenie wynikające z etapu dojrzałości organizacji</div>
          {current ? (
            <>
              <div className="mt-3 text-[20px] font-semibold tracking-tight">{current.number} — {current.name}</div>
              <p className="mt-1 text-[13.5px] text-ink-soft">{current.main_constraint}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Fact label="Role">{current.role}</Fact>
                <Fact label="Typical headcount">{current.headcount_label}</Fact>
                <Fact label="Graduate by" className="col-span-2">{current.graduate_by}</Fact>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 text-[20px] font-semibold tracking-tight text-muted">Assessment needed</div>
              <p className="mt-2 text-[13px] text-muted">Etap nie został jeszcze oceniony. Użyj ASSESS HORMOZI STAGE lub ustaw etap ręcznie.</p>
            </>
          )}
        </Card>
      </div>

      {/* ── Roadmap × Constraint */}
      <Card id="alignment">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="h2">Constraint Alignment</h3>
          <AlignmentPill alignment={alignment} />
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Observed Primary Constraint">{observed?.name}</Fact>
          <Fact label="Hormozi Stage">{current?.name}</Fact>
          <Fact label="Hormozi Typical Constraint">{current?.typical_constraint}</Fact>
          <Fact label="Alignment">{alignment.level ?? "—"}</Fact>
        </div>
        {alignment.recommendation && (
          <div className="mt-4">
            <div className="eyebrow">Hormozi {alignment.recommendation.area} recommendation · Stage {current?.number}</div>
            <p className="mt-0.5 text-[13.5px]">{alignment.recommendation.items.join(" + ")}</p>
          </div>
        )}
        <div className="mt-4 rounded-lg bg-sunken px-4 py-3">
          <div className="eyebrow">Interpretation</div>
          <p className="mt-1 text-[13.5px] text-ink-soft">{alignment.interpretation}</p>
        </div>
        {alignment.aiQuestion && (
          <div className="mt-3 rounded-lg border border-watch/30 bg-watch-soft/60 px-4 py-3">
            <div className="eyebrow !text-watch">AI question</div>
            <p className="mt-1 text-[13.5px] font-medium text-ink">„{alignment.aiQuestion}”</p>
            {ga && ai && <div className="mt-3">{aiButton("explain_mismatch")}</div>}
          </div>
        )}
      </Card>

      {/* ── Stage Debt */}
      <Card id="debt">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="h2">Stage Debt</h3>
          <DebtPill debt={debt} />
        </div>
        {debt.level == null ? (
          <p className="mt-3 text-[13px] text-muted">Oceń etap lub podaj headcount, aby policzyć Stage Debt.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <Fact label="Structural stage (organizational size)">{stageLabel(stages.find((s) => s.number === debt.structuralStage))}</Fact>
              <Fact label="Lowest unresolved stage (business maturity)">{stageLabel(stages.find((s) => s.number === debt.lowestUnresolved))}</Fact>
              <Fact label="Stage debt">{debt.level}{debt.gap > 0 ? ` · ${debt.gap} stage${debt.gap > 1 ? "s" : ""} behind` : ""}</Fact>
            </div>
            <p className={cn("mt-4 text-[13.5px]", debt.gap > 0 ? "font-medium text-ink" : "text-muted")}>{debt.gap > 0 ? `„${debt.message}”` : debt.message}</p>
            {debt.action && <p className="mt-1 text-[13.5px] text-ink-soft"><span className="eyebrow mr-2">Recommended action</span>{debt.action}</p>}
            {debt.failed.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow mb-1.5">Nierozwiązane wymagania wcześniejszych etapów</div>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {debt.failed.map((i) => (
                    <li key={i.id} className="flex items-start gap-3 px-3 py-2 text-[13px]">
                      <Dot status="fail" /><span className="-mt-0.5 flex-1">{i.text}{i.comment && <span className="text-muted"> — {i.comment}</span>}</span>
                      <Link href={`${base}?stage=${i.stage_number}&open=${i.id}#checklist`} className="shrink-0 text-xs text-muted underline underline-offset-2">Stage {i.stage_number}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {debt.unverified > 0 && <p className="mt-3 text-xs text-muted">{debt.unverified} wymagań wcześniejszych etapów nie zostało jeszcze zweryfikowanych — Stage Debt liczy tylko pozycje oznaczone jako Fail.</p>}
          </>
        )}
      </Card>

      {/* ── Assessment */}
      <Card id="assessment">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="h2">Stage Assessment</h3>
            <p className="mt-0.5 max-w-xl text-[13px] text-muted">Headcount to tylko sygnał. Etap oceniamy po zachowaniu biznesu: powtarzalności acquisition, monetization, strukturze, rodzaju problemów, dojrzałości procesów, LTV:CAC, founder dependency, liczbie produktów i specjalizacji.</p>
          </div>
          {ga && ai && aiButton("assess_stage", true)}
        </div>
        {ga && !ai && <p className="mt-3 text-xs text-muted">AI nie jest skonfigurowane (OPENAI_API_KEY / OPENAI_MODEL) — etap można ustawić ręcznie.</p>}

        {proposal?.ai_assessment && (() => {
          const a = proposal.ai_assessment!;
          const name = (n: number | null | undefined) => (n == null ? "—" : `${n} — ${stages.find((s) => s.number === n)?.name ?? "?"}`);
          return (
            <div className="mt-4 rounded-lg border border-line-strong bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2"><Pill tone="ink">AI proposal</Pill><span className="text-xs text-muted">{fmtDate(proposal.created_at)} · czeka na decyzję Growth Architecta</span></div>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Current stage"><span className="text-[17px] font-semibold">{name(a.current_stage)}</span></Fact>
                <Fact label="Confidence"><span className="text-[17px] font-semibold">{a.confidence}%</span></Fact>
                <Fact label="Why" className="sm:col-span-2"><ul className="list-disc pl-5 text-[13.5px]">{a.why.map((w, i) => <li key={i}>{w}</li>)}</ul></Fact>
                <Fact label="Previous stage requirements" className="sm:col-span-2">
                  <div className="flex flex-wrap gap-1.5">
                    {a.previous_stage_requirements.map((r, i) => (
                      <span key={i} title={r.note} className={cn("pill", r.status === "PASS" ? "pill-healthy" : r.status === "FAIL" ? "pill-critical" : "")}>{name(r.stage)} · {r.status}</span>
                    ))}
                    {a.previous_stage_requirements.length === 0 && "—"}
                  </div>
                  {a.previous_stage_requirements.filter((r) => r.status !== "PASS" && r.note).map((r, i) => <p key={i} className="mt-1 text-[13px] text-muted">Stage {r.stage}: {r.note}</p>)}
                </Fact>
                <Fact label="Current stage constraint">{a.current_stage_constraint}</Fact>
                <Fact label="Graduate by">{a.graduate_by}</Fact>
                <Fact label="Most relevant actions" className="sm:col-span-2"><ol className="list-decimal pl-5 text-[13.5px]">{a.most_relevant_actions.map((w, i) => <li key={i}>{w}</li>)}</ol></Fact>
                <Fact label="Next stage">{name(a.next_stage)}</Fact>
                <Fact label="What would indicate readiness"><ul className="list-disc pl-5 text-[13.5px]">{a.readiness_indicators.map((w, i) => <li key={i}>{w}</li>)}</ul></Fact>
                {a.observed_vs_expected && <Fact label="Observed vs expected" className="sm:col-span-2">{a.observed_vs_expected}</Fact>}
                {!!a.missing_data?.length && <Fact label="Missing data" className="sm:col-span-2"><ul className="list-disc pl-5 text-[13.5px]">{a.missing_data.map((w, i) => <li key={i}>{w}</li>)}</ul></Fact>}
              </div>
              {ga && (
                <form action={resolveAssessment} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[180px_1fr]">
                  {hiddenLine}<input type="hidden" name="id" value={proposal.id} />
                  <Field label="Stage to record">
                    <select name="stage_number" defaultValue={a.current_stage} className="input">
                      {stages.map((s) => <option key={s.number} value={s.number}>{s.number} — {s.name}{s.number === a.current_stage ? " (AI)" : ""}</option>)}
                    </select>
                  </Field>
                  <Field label="Reason / evidence (wymagane przy manual override)"><input name="reason" className="input" placeholder="Dlaczego akceptujesz, zmieniasz lub odrzucasz tę ocenę?" /></Field>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button name="decision" value="accept" className="btn btn-primary">Accept / record stage</button>
                    <button name="decision" value="reject" className="btn">Reject proposal</button>
                    <span className="self-center text-xs text-muted">Wybranie innego etapu niż AI zapisuje decyzję jako manual override.</span>
                  </div>
                </form>
              )}
            </div>
          );
        })()}

        {ga && (
          <div className="mt-4 flex flex-wrap items-start gap-2">
            {ai && ["hormozi_fix_next", "challenge_stage", "graduation_audit", "stage_regression"].map((a) => aiButton(a))}
            <details className="w-full">
              <summary className="btn mt-1 w-fit">Set stage manually</summary>
              <form action={setStageManually} className="mt-3 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[180px_160px_1fr]">
                {hiddenLine}
                <Field label="Stage">
                  <select name="stage_number" defaultValue={current?.number ?? ""} required className="input">
                    <option value="" disabled>Select…</option>
                    {stages.map((s) => <option key={s.number} value={s.number}>{s.number} — {s.name}</option>)}
                  </select>
                </Field>
                <Field label="Date"><input type="date" name="assessed_on" className="input" /></Field>
                <Field label="Reason (required)"><input name="reason" required className="input" /></Field>
                <Field label="Evidence" className="sm:col-span-3"><textarea name="evidence" rows={2} className="input" placeholder="Dane / obserwacje, na których opiera się decyzja" /></Field>
                <div><Submit className="btn-primary">Record stage</Submit></div>
              </form>
            </details>
          </div>
        )}
        {current && next && (
          <p className="mt-4 text-[13px] text-muted">Next stage: <span className="font-medium text-ink">{next.number} — {next.name}</span>. Gotowość = spełniona graduation checklist etapu {current.name}.</p>
        )}
      </Card>

      {/* ── Selected stage */}
      <Card id="stage">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="h2">Stage {selected.number} — {selected.name}</h3>
          {current?.number === selected.number && <Pill tone="ink">Current stage</Pill>}
          {current && selected.number < current.number && <Pill tone="healthy">Graduated</Pill>}
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Role">{selected.role}</Fact>
          <Fact label="Typical headcount">{selected.headcount_label}</Fact>
          <Fact label="Main constraint" className="lg:col-span-2">{selected.main_constraint}{selected.typical_symptom && <span className="text-muted"> Typowy symptom: {selected.typical_symptom}.</span>}</Fact>
          <Fact label="Graduate by" className="sm:col-span-2">{selected.graduate_by}</Fact>
          <Fact label="Hormozi question" className="sm:col-span-2"><span className="italic">„{selected.question}”</span></Fact>
        </div>
        {selected.note && <p className="mt-3 text-[13px] text-ink-soft">{selected.note}</p>}
        <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {selected.guidance.map((g) => (
            <div key={g.area}>
              <div className="eyebrow mb-1">{g.area}</div>
              <ul className="space-y-0.5 text-[13px] text-ink-soft">{g.items.map((it) => <li key={it} className="flex gap-2"><span className="text-line-strong">—</span>{it}</li>)}</ul>
            </div>
          ))}
          {selected.strong_signals.length > 0 && (
            <div>
              <div className="eyebrow mb-1">Strong signals</div>
              <ul className="space-y-0.5 text-[13px] text-ink-soft">{selected.strong_signals.map((it) => <li key={it} className="flex gap-2"><span className="text-line-strong">—</span>{it}</li>)}</ul>
            </div>
          )}
        </div>

        <div id="checklist" className="mt-6 border-t border-line pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="h2">Graduation checklist — is the business ready to graduate?</h4>
            <span className="text-xs text-muted">{passed} / {items.length} pass</span>
          </div>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {items.map((i) => (
              <li key={i.id}>
                <details open={sp.open === i.id}>
                  <summary className="flex items-center gap-3 px-3 py-2.5 hover:bg-sunken/60">
                    <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold",
                      i.status === "pass" ? "border-healthy bg-healthy text-white" : i.status === "fail" ? "border-critical bg-critical-soft text-critical" : "border-line-strong bg-white")}>
                      {i.status === "pass" ? "✓" : i.status === "fail" ? "×" : ""}
                    </span>
                    <span className="flex-1 text-[13.5px]">{i.text}</span>
                    {i.owner_name && <span className="hidden text-xs text-muted sm:inline">{i.owner_name}</span>}
                    {i.metric && <span className="hidden max-w-40 truncate text-xs text-muted md:inline">{i.metric}</span>}
                    <span className="text-xs text-muted">{ITEM_LABEL[i.status]}</span>
                  </summary>
                  <form action={saveRoadmapItem} className="grid gap-3 bg-sunken/40 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
                    {hiddenLine}<input type="hidden" name="item_id" value={i.id} />
                    <fieldset disabled={!canEdit} className="contents">
                      <Field label="Status">
                        <select name="status" defaultValue={i.status} className="input">
                          {Object.entries(ITEM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </Field>
                      <Field label="Owner"><UserSelect name="owner_id" users={users} value={i.owner_id} /></Field>
                      <Field label="Metric" className="lg:col-span-2"><input name="metric" defaultValue={i.metric} className="input" /></Field>
                      <Field label="Comment" className="sm:col-span-2"><textarea name="comment" rows={2} defaultValue={i.comment} className="input" /></Field>
                      <Field label="Evidence" className="sm:col-span-2"><textarea name="evidence" rows={2} defaultValue={i.evidence} className="input" /></Field>
                      {canEdit && <div className="flex items-center gap-3"><Submit className="btn-primary btn-sm">Save</Submit>{i.updated_at && <span className="text-xs text-muted">updated {fmtDate(i.updated_at)}</span>}</div>}
                    </fieldset>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* ── History */}
      <Card id="history">
        <h3 className="h2">Roadmap history</h3>
        {history.length === 0 ? <div className="mt-3"><Empty>Brak historii — etap nie był jeszcze oceniany.</Empty></div> : (
          <ol className="mt-3 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className={cn("grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[84px_1fr]", h.status === "rejected" && "opacity-60")}>
                <div className="text-[13px] tabular-nums text-muted">{fmtDate(h.assessed_on).slice(3)}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-medium">Stage {h.stage_number} — {stages.find((s) => s.number === h.stage_number)?.name}</span>
                    <Pill>{h.source === "ai" ? "AI assessment" : "Manual"}</Pill>
                    {h.manual_override && <Pill tone="watch">Manual override</Pill>}
                    {h.status === "proposed" && <Pill tone="ink">Proposed</Pill>}
                    {h.status === "rejected" && <Pill tone="resolved">Rejected</Pill>}
                    {h.confidence != null && <span className="text-xs text-muted">confidence {h.confidence}%</span>}
                  </div>
                  {h.reason && <p className="mt-1 text-[13px] text-ink-soft"><span className="eyebrow mr-2">Reason</span>{h.reason}</p>}
                  {h.evidence && <p className="mt-0.5 text-[13px] text-ink-soft"><span className="eyebrow mr-2">Evidence</span>{h.evidence}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>Author: {h.author_name ?? "—"} · {fmtDate(h.assessed_on)}</span>
                    {h.ai_assessment && (
                      <details>
                        <summary className="underline underline-offset-2">AI assessment{h.manual_override ? ` (AI proposed Stage ${h.ai_assessment.current_stage})` : ""}</summary>
                        <div className="mt-2 max-w-2xl rounded-md bg-sunken p-3 text-[12.5px] text-ink-soft">
                          <p><b>AI stage:</b> {h.ai_assessment.current_stage} · <b>confidence:</b> {h.ai_assessment.confidence}%</p>
                          <ul className="mt-1 list-disc pl-5">{h.ai_assessment.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
                          {h.ai_assessment.observed_vs_expected && <p className="mt-1">{h.ai_assessment.observed_vs_expected}</p>}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
