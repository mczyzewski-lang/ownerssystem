# Growth Architect OS — architektura

## 1. Architektura

```
Browser ──► Next.js 16 App Router
             ├─ Server Components (odczyt)  ──► lib/*-data.ts ──► PostgreSQL (Supabase)   [DATABASE_URL, postgres.js]
             ├─ Server Actions (zapis)      ──► lib/actions/*.ts  (uprawnienia + reguły produktu)
             ├─ proxy.ts                    ──► odświeżanie sesji Supabase Auth
             └─ lib/ai.ts                   ──► OpenAI (OPENAI_API_KEY, OPENAI_MODEL) — tylko serwer
```

- **Brak API po stronie klienta.** Formularze wywołują Server Actions; po zapisie akcja wraca na stronę źródłową z
  `?notice=` / `?error=`. Minimalny JS w przeglądarce (stany przycisków, flash, aktywna nawigacja).
- **Uprawnienia** (`lib/auth.ts`): rola globalna Growth Architect = pełny dostęp; pozostali działają w roli nadanej w
  `business_members`. Poziomy: `view` (Viewer), `contribute` (Business Owner: checklisty, komentarze, dane, hipotezy,
  eksperymenty, chat AI), `manage` (Growth Architect: constrainty, cykle, decyzje, akcje AI, etap roadmapy, ustawienia).
- **Reguły produktu egzekwowane na serwerze i w bazie:**
  - jeden `MAIN CONSTRAINT` na linię — partial unique index + ekran potwierdzenia przy próbie ustawienia drugiego,
  - jeden aktywny Growth Cycle na linię — partial unique index; nowy cykl powstaje jako `planned`,
  - aktywne (Prioritized / Testing) mogą być max 3 hipotezy i tylko dotyczące MAIN CONSTRAINT; max 3 eksperymenty `running`,
  - AI niczego nie zmienia: ocena etapu trafia do historii jako `proposed` i czeka na decyzję człowieka.
- **Template vs. dane linii:** taksonomia (`constraints`, `checklist_nodes`) i roadmapa (`roadmap_stages`,
  `roadmap_checklist_items`) są globalne; statusy, notatki i komentarze są per linia (`*_reviews`).

### Roadmapa jako soczewka, nie źródło prawdy

`lib/roadmap.ts` (czysta logika, testy w `tests/`):

- **Constraint Alignment** — porównuje *Observed Primary Constraint* (Constraint Engine) z typowym constraintem etapu:
  `STRONG DIAGNOSTIC ALIGNMENT` / `PARTIAL ALIGNMENT` / `DIAGNOSTIC MISMATCH` (+ pytanie dla AI) / `ASSESSMENT NEEDED`.
  Mapowanie etap → obszary constraintów jest w `db/seed/roadmap.ts` (`primaryConstraints`, `secondaryConstraints`).
- **Stage Debt** — `structural stage` (sygnał z headcount) vs `lowest unresolved stage` (najniższy wcześniejszy etap z
  wymaganiem oznaczonym `Fail`, nie wyżej niż oceniony etap). Różnica 0 → LOW, 1–2 → MEDIUM, ≥3 → HIGH.
- Kolejność priorytetów w prompcie systemowym AI: economics → funnel → observed constraint → root cause → roadmapa.

## 2. Schemat bazy (`db/migrations/0001_init.sql`)

| Obszar | Tabele |
|---|---|
| Ludzie i linie | `users`, `business_lines`, `business_members` |
| Taksonomia (global) | `constraints`, `checklist_nodes` (section → subsection → item, stabilny `key`) |
| Review per linia | `constraint_reviews`, `constraint_status_history`, `checklist_reviews` |
| Komentarze | `comments` (dowolny target, wątki, mentions, status, kind: comment / question / data_request), `comment_edits`, `attachments` |
| Growth | `growth_cycles`, `hypotheses`, `hypothesis_node_links`, `experiments` |
| Dane | `funnel_definitions`, `funnel_steps`, `funnel_data`, `metrics`, `data_imports` (raw + parsed) |
| Decyzje | `decisions` |
| AI | `ai_conversations` (snapshot constraintu i cyklu), `ai_messages` |
| Roadmapa | `roadmap_stages`, `roadmap_checklist_items`, `roadmap_checklist_reviews`, `stage_assessments` (historia: reason, evidence, author, AI assessment, manual override) |

## 3. Sitemap

```
/login                         logowanie
/                              Holding dashboard: Constraints & Cycles + Scaling Roadmap (cross-business)
/decisions                     Decision log całego holdingu
/search?q=                     Global search
/settings                      Users & roles · Business lines · Taxonomy · Framework info · System
/b/[line]                      Overview: Current Primary Constraint + Constraint Map + historia
/b/[line]/review               Review Mode: drzewo checklisty + panel elementu (status, note, evidence, komentarze, hipotezy, AI)
/b/[line]/hypotheses[/id]      tabela hipotez (score) · szczegóły + eksperymenty + komentarze
/b/[line]/cycles               Growth Cycles
/b/[line]/funnel               Funnel Builder, dane per okres / segment / source, największa strata
/b/[line]/data                 Data Room: opis biznesu, importy, metryki
/b/[line]/roadmap              Scaling Roadmap: oś 10 etapów, alignment, stage debt, assessment, checklist, historia
/b/[line]/ai                   Growth AI: akcje, chat, historia rozmów
/b/[line]/decisions            Decision log linii
/b/[line]/workspace            Owner Workspace (domyślny ekran ownera)
/b/[line]/team                 ustawienia linii: nazwa, owner, Growth Architect, zespół, archiwizacja
```

## 4. Najważniejsze user flows

1. **Diagnoza** — Review Mode: przejście checklisty z ownerem (Next item →), statusy Healthy / Concern / Candidate,
   notatki i dowody na każdym poziomie → kandydaci → `Set status: MAIN CONSTRAINT` (z uzasadnieniem, historia zostaje).
2. **Growth Cycle** — dla MAIN CONSTRAINT: metryka, baseline, target, upside, root causes, Condition of Victory → Activate.
3. **Hipotezy → eksperymenty** — hipotezy w backlogu ze score; max 3 aktywne dla głównego constraintu; eksperyment
   z metryką i deadline; wynik → Won / Lost / Inconclusive → zamknięcie cyklu z retrospektywą → kolejny constraint.
4. **Scaling Roadmap** — `ASSESS HORMOZI STAGE` (AI proponuje) → Accept / manual override z uzasadnieniem / Reject →
   graduation checklist → Constraint Alignment i Stage Debt liczone na bieżąco → przy mismatch pytanie do AI.
5. **Owner** — wchodzi do Workspace: This Cycle, This Week, pytania Growth Architecta, dane do uzupełnienia,
   komentarze wymagające odpowiedzi; resztę widzi po przejściu do Full diagnostic.
6. **Pamięć** — każda akcja AI i rozmowa zapisuje constraint i cykl z tamtego momentu; Decision log, historia
   constraintów i etapów oraz global search pozwalają po roku odtworzyć „dlaczego tak zdecydowaliśmy”.

## 5. Wireframe'y głównych ekranów

```
HOLDING DASHBOARD
┌ sidebar ─────┐ ┌ Constraints & Growth Cycles ───────────────────────────────────────────┐
│ Search       │ │ Business | Primary Constraint | Metric | Baseline | Target | Owner | Cycle | Status │
│ Dashboard    │ └──────────────────────────────────────────────────────────────────────────┘
│ Decisions    │ ┌ Scaling Roadmap ───────────────────────────────────────────────────────┐
│ PRAVNA …     │ │ Business | Hormozi Stage | Primary Constraint | Alignment | Stage Debt | Next Graduation │
│ SPÓŁKI …     │ └──────────────────────────────────────────────────────────────────────────┘
└──────────────┘

BUSINESS LINE — OVERVIEW
┌ CURRENT PRIMARY CONSTRAINT ─────────────────────────────────── [ACTIVE] ┐
│ SALES CONVERSION                                                        │
│ Metric | Baseline | Target | Owner | Cycle | Upside | Confidence | CoV  │
└─────────────────────────────────────────────────────────────────────────┘
Constraint Map:  [01 Market/ICP]→[02 Offer]→[03 Lead Gen]→[04 Lead→Appt]
                 [05 Show-up]→[06 SALES ●MAIN]→[07 Delivery]→[08 LTV]
                 [09 People / Management / Ownership — cross-cutting      ]

REVIEW MODE
┌ tree ──────────────┐ ┌ Offer → Pricing → Base + Success Fee ──────────────┐
│ 2. OFFER           │ │ Czy klient postrzega alignment interesów?          │
│  2.2 Pricing       │ │ STATUS  ( ) Not reviewed ( ) Healthy (•) Concern … │
│   Base+Success Fee │ │ NOTE / EVIDENCE / METRIC / LINK / OWNER            │
│    ● Alignment     │ │ [Save] ← Previous   Next item →                    │
│    ○ Cashflow      │ │ RELATED HYPOTHESES · ATTACHMENTS · AI · COMMENTS   │
└────────────────────┘ └────────────────────────────────────────────────────┘

SCALING ROADMAP
 ✓IMPROVISE ─ ✓MONETIZE ─ ✓ADVERTISE ─ ✓STABILIZE ─ ✓PRIORITIZE ─ ✓PRODUCTIZE ─ ●OPTIMIZE ─ 7 ─ 8 ─ 9
┌ 1 · Observed Primary Constraint ┐ ┌ 2 · Hormozi Stage Constraint ┐
│ SALES CONVERSION                │ │ 6 — OPTIMIZE · Efficiency    │
└─────────────────────────────────┘ └──────────────────────────────┘
┌ Constraint Alignment ───────────────────── [STRONG DIAGNOSTIC ALIGNMENT] ┐
┌ Stage Debt ─ structural stage · lowest unresolved stage ─────────── [LOW] ┐
┌ Stage Assessment ─ [ASSESS HORMOZI STAGE] · AI proposal → Accept / Override / Reject ┐
┌ Stage N ─ guidance per obszar · Graduation checklist (status, comment, evidence, owner, metric) ┐
┌ Roadmap history ─ data · etap · reason · evidence · author · AI assessment · manual override ┐
```
