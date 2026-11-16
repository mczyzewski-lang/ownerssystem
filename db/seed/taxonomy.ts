// Global constraint taxonomy template.
// Outline format:  "# key | number | NAME | description [| cross]"  → constraint
//                  "## title"   → section      "### title" → subsection
//                  "- title"    → atomic review item      "> text" → description of the previous node
// Adding a line here and re-running `npm run db:seed` adds the node to every business line
// without touching existing reviews (nodes are upserted by a stable path key).

export const TAXONOMY = `
# market_icp | 1 | MARKET / ICP | Czy operujemy na odpowiednim rynku i docieramy do klientów, których problem, zdolność do zakupu, urgency i economics powodują, że biznes może rosnąć?
## 1.1 Market
- Czy znamy TAM?
- Czy znamy SAM?
- Czy znamy realny SOM?
- Czy rynek rośnie czy maleje?
- Czy istnieje strukturalny trend wspierający popyt?
- Czy biznes jest zależny od regulacji?
- Czy zmiana prawa może zniszczyć popyt?
- Czy rynek jest wystarczająco duży dla naszego celu 3–5 lat?
- Czy istnieją geograficzne możliwości expansion?
- Czy istnieją adjacent markets?
- Czy istnieją nowe use cases?
- Czy istnieje ryzyko commoditization?
- Czy problem klienta jest must-have czy nice-to-have?
- Jak często problem występuje?
- Jak pilny jest problem?
- Czy klient aktywnie szuka rozwiązania?
- Czy klient rozumie problem przed kontaktem z nami?
## 1.2 ICP
- Czy mamy jasno określony ICP?
- Czy ICP wynika z danych czy intuicji?
- Czy znamy top 10 cech najlepiej konwertujących klientów?
- Czy znamy segmenty o najwyższym close rate?
- Czy znamy segmenty o najwyższym AOV?
- Czy znamy segmenty o najwyższym LTV?
- Czy znamy segmenty o najniższym CAC?
- Czy znamy segmenty o najwyższej marży?
- Czy znamy segmenty z najkrótszym sales cycle?
- Czy znamy segmenty generujące najmniej problemów operacyjnych?
- Czy potrafimy rozpoznać dobrego klienta przed rozmową sprzedażową?
- Czy formularz zbiera dane potrzebne do segmentacji?
- Czy CRM przechowuje dane ICP?
- Czy umiemy wykluczać złe leady?
- Czy mamy jasno określony Anti-ICP?
## 1.3 Segmentacja
> Dla każdego segmentu: Lead volume → Booking → Show → Close → AOV → CAC → LTV → Gross Profit (dane per segment wprowadzaj w zakładce Funnel, pole „segment”).
- segmentacja po wartości problemu
- segmentacja po urgency
- segmentacja po zdolności finansowej
- segmentacja po demografii
- segmentacja po zachowaniu
- segmentacja po źródle
- segmentacja po etapie customer journey
- segmentacja po produkcie
- segmentacja po potencjalnym LTV
- segmentacja po probability to close

# offer | 2 | OFFER / VALUE PROPOSITION | Czy klient rozumie wystarczająco dużą wartość rozwiązania, aby kupić teraz właśnie od nas?
## 2.1 Core offer
- Czy rezultat usługi jest jasno nazwany?
- Czy sprzedajemy rezultat czy proces?
- Czy oferta rozwiązuje największy problem klienta?
- Czy oferta redukuje największe ryzyko klienta?
- Czy klient rozumie „dlaczego teraz”?
- Czy klient rozumie różnicę między nami a konkurencją?
- Czy USP jest prawdziwe?
- Czy USP jest mierzalne?
- Czy USP jest trudne do skopiowania?
- Czy oferta jest prosta do wyjaśnienia w jednym zdaniu?
- Czy zakres usługi jest transparentny?
- Czy klient rozumie czego oferta NIE zawiera?
- Czy komunikujemy proces krok po kroku?
- Czy pokazujemy expected outcome?
- Czy pokazujemy time-to-value?
## 2.2 Pricing
### Pricing model
- jednorazowa płatność
- raty
- subscription
- success fee
- base fee + success fee
- deposit + balance
- pay-per-result
- tiered pricing
- pakiety Basic / Standard / Premium
- pricing zależny od wartości problemu
- pricing zależny od segmentu
- pricing zależny od complexity
- pricing zależny od urgency
- financing
### Base + Success Fee
- Czy można obniżyć entry price?
- Czy można przenieść część ceny na wynik?
- Jaki jest możliwy event wyzwalający success fee?
- Czy event jest jednoznaczny?
- Czy da się go łatwo zmierzyć?
- Czy success fee jest prawnie możliwe?
- Czy klient postrzega alignment interesów?
- Czy klient rozumie pełny koszt?
- Czy success fee poprawia conversion?
- Czy success fee zwiększa AOV?
- Czy zwiększa ryzyko cashflow?
- Czy zwiększa ryzyko collections?
- Jak zmienia CAC payback?
- Jak zmienia gross margin?
- Jak wpływa na sales script?
- Jak wpływa na umowę?
- Jak wpływa na delivery?
## 2.3 Price testing
- Czy znamy willingness to pay?
- Czy testowaliśmy wyższą cenę?
- Czy testowaliśmy niższą cenę wejściową?
- Czy testowaliśmy różne anchory?
- Czy testowaliśmy 3 pakiety?
- Czy mierzymy conversion per price point?
- Czy mierzymy AOV × conversion, nie tylko conversion?
- Czy istnieje pricing floor?
- Czy istnieje segment, który można drożej monetyzować?
## 2.4 Guarantee / Risk Reversal
- gwarancja rezultatu
- gwarancja procesu
- zwrot pieniędzy
- performance guarantee
- conditional guarantee
- brak gwarancji
- czy gwarancja jest prawnie bezpieczna
- czy gwarancja jest operacyjnie możliwa
- czy gwarancja zwiększa perceived value
- czy istnieje ryzyko overpromise
## 2.5 Packaging
- jedna oferta vs kilka pakietów
- premium package
- entry offer
- downsell
- upsell
- cross-sell
- bundle
- continuity product
- recurring element
- service + product
- service + success fee
- offer dla specyficznego ICP
## 2.6 Proof
- testimonials
- liczba klientów
- reviews
- rating
- case studies
- before/after
- dane liczbowe
- czas realizacji
- success rate
- autorytet ekspertów
- media
- certyfikaty
- social proof dopasowany do ICP

# lead_generation | 3 | LEAD GENERATION / DISTRIBUTION | Czy dostarczamy wystarczająco dużo właściwego popytu przy akceptowalnym CAC?
## 3.1 Paid Search
- Google Search
- Performance Max
- Demand Gen
- competitor keywords
- high intent keywords
- problem keywords
- brand
- non-brand
- negative keywords
- impression share
- lost IS budget
- lost IS rank
- quality score
- landing page matching
- conversion tracking
- offline conversion
- value-based bidding
- lead quality feedback loop
- CAC per campaign
- Revenue per campaign
- Gross Profit per campaign
## 3.2 Paid Social
- Meta
- TikTok
- LinkedIn
- YouTube
- creative volume
- creative fatigue
- hooks
- audience
- broad targeting
- remarketing
- lead forms
- LP
- video
- advertorial
- VSL
- creator content
- native content
- value optimization
## 3.3 Organic
- SEO
- informational SEO
- transactional SEO
- programmatic SEO
- YouTube
- TikTok
- Instagram
- LinkedIn
- founder brand
- expert brand
- community
- newsletter
## 3.4 Partnerships
- referral partners
- affiliates
- strategic partners
- complementary services
- marketplaces
- associations
- influencers
- professionals referring clients
## 3.5 Database
- old leads
- previous clients
- dormant clients
- newsletter database
- SMS
- WhatsApp
- e-mail nurturing
- reactivation
- trigger campaigns
## 3.6 New acquisition surfaces
- lead magnets
- calculators
- diagnostic tools
- quizzes
- free consultations
- free audits
- reports
- webinars
- workshops
- free samples
- demo
- free plan
- adjacent brand
- upstream product
- downstream product
## 3.7 Channel economics
> Dla każdego kanału. Dane liczbowe per kanał wprowadzaj w zakładce Funnel (pole „source”) i Data Room.
- spend
- traffic
- leads
- MQL
- SQL
- meetings
- sales
- CAC
- revenue
- gross profit
- payback
- saturation
- scalability

# lead_to_appointment | 4 | LEAD → APPOINTMENT / QUALIFICATION | Czy istniejący lead faktycznie staje się jakościową szansą sprzedażową?
## 4.1 Lead capture
- formularz długość
- telefon required / optional
- email required
- WhatsApp
- quiz
- progressive profiling
- friction
- consent
- mobile UX
## 4.2 Speed-to-lead
- <1 min
- <5 min
- <15 min
- <1h
- >1h
- automatyczny SMS
- WhatsApp
- auto call
- routing
## 4.3 Contactability
- % dodzwonionych
- próby 1–3
- próby 4–7
- próby 8+
- różne godziny
- weekend
- SMS
- WhatsApp
- email
- voicemail
- callback
## 4.4 Qualification
- jasna definicja MQL
- jasna definicja SQL
- financial qualification
- urgency
- problem severity
- authority
- fit
- disqualification rules
- scoring
- AI lead scoring
## 4.5 Booking
- telefoniczne
- self-booking
- Calendly-like
- immediate call
- wybór terminu
- długość oczekiwania
- dobór handlowca
- routing po segmencie

# show_up | 5 | SHOW-UP | Czy umówione rozmowy faktycznie się odbywają — i czy robimy wszystko, żeby klient przyszedł przygotowany?
- długość lead → meeting
- reminder SMS
- reminder email
- reminder WhatsApp
- calendar invite
- confirmation
- commitment question
- pre-call questionnaire
- pre-call video
- social proof przed call
- agenda calla
- przedstawienie konsultanta
- informacja „co przygotować”
- wartość konsultacji
- rescheduling flow
- no-show recovery
- no-show immediate call
- no-show nurturing
- show-up per source
- show-up per salesperson
- show-up per time slot
- show-up per ICP
- show-up per waiting time

# sales_conversion | 6 | SALES CONVERSION | Czy z właściwych odbytych rozmów wyciągamy maksymalną liczbę płacących klientów?
## 6.1 Sales architecture
- jasny sales process
- etapy rozmowy
- discovery
- diagnosis
- problem awareness
- cost of inaction
- desired outcome
- gap
- offer presentation
- proof
- price
- close
- next step
## 6.2 Sales Script
### Opening
- agenda
- trust
- permission
- role rozmowy
### Discovery
- obecna sytuacja
- problem
- od kiedy istnieje
- wcześniejsze próby rozwiązania
- dlaczego nie zadziałały
- konsekwencje
- koszt problemu
- urgency
- trigger event
### Desired outcome
- czego klient chce
- dlaczego
- kiedy
- co zmieni rozwiązanie
### Qualification
- fit
- ability to pay
- decision maker
- timing
- readiness
- risk
### Value creation
- pokazanie procesu
- mapowanie usługi do problemu
- personalizacja
- value stack
- ROI
- cost of doing nothing
- differentiation
### Offer
- jedna oferta
- package
- anchor
- pricing
- rata
- success fee
- guarantee
- bonus
- urgency
- scarcity — tylko jeśli prawdziwa
### Objections
- cena
- muszę pomyśleć
- muszę porozmawiać z partnerem
- konkurencja
- zrobię sam
- jeszcze nie teraz
- nie ufam
- brak pieniędzy
- inne priorytety
### Close
- jasne pytanie o decyzję
- payment link
- contract
- first payment
- onboarding immediately
## 6.3 Follow-up
- first follow-up
- 24h
- 48h
- 3d
- 7d
- 14d
- 30d
- 60d
- nurturing
- call
- SMS
- WhatsApp
- email
- proof
- FAQ
- case study
- urgency event
## 6.4 Sales segmentation
- różne skrypty per ICP
- różne oferty per ICP
- różny pricing
- różne objection trees
- różny routing handlowca
- high value lead handling
- low value lead handling
## 6.5 Sales team performance
> Per salesperson.
- calls
- shows
- wins
- show→win
- revenue
- AOV
- refunds
- close by ICP
- close by source
- follow-up wins
## 6.6 Top performer replication
- czy istnieje wyraźny top performer
- jaka jest różnica vs median
- analiza nagrań
- analiza słów
- analiza discovery
- analiza objection handling
- analiza follow-up
- coaching
- scorecard rozmowy
- mystery shopping
- AI call scoring
## 6.7 Sales management
- jasny owner wyniku
- daily metrics
- weekly review
- 1:1
- call review
- coaching
- training
- hiring
- firing
- compensation
- leaderboard
- conversion targets
- forecast accuracy

# delivery | 7 | DELIVERY ECONOMICS / CAPACITY | Czy wzrost sprzedaży produkuje większy zysk, czy tylko większą ilość pracy?
## 7.1 Economics
- revenue/client
- gross margin/client
- contribution margin/client
- direct labour
- external costs
- refund rate
- rework
- complaints
- cost-to-serve
## 7.2 Capacity
- customers per employee
- utilisation
- backlog
- SLA
- waiting time
- bottleneck roles
- capacity +25%
- capacity +50%
- capacity ×2
## 7.3 Process
- manual steps
- automation
- standardization
- templates
- AI automation
- self-service
- customer portal
- handoffs
- duplicate work
- approvals
## 7.4 Communication cost
- calls/client
- emails/client
- WhatsApp/messages
- repeated questions
- customer education
- documentation collection
- status questions
- reminders
## 7.5 Quality
- errors
- refunds
- complaints
- delays
- NPS/CSAT
- legal risk
- missed deadlines
## 7.6 Scalability
- revenue per employee
- gross profit per employee
- incremental margin
- headcount elasticity
- outsourcing
- subcontractors
- automation potential

# ltv_expansion | 8 | LTV / EXPANSION / REFERRALS | Czy po zapłaceniu CAC wyciągamy z relacji z klientem pełną wartość — upsell, cross-sell, retencję i polecenia?
## 8.1 Upsell
- następny naturalny produkt
- premium service
- additional support
- additional documentation
- faster service
- success fee add-on
## 8.2 Cross-sell
- inne problemy tego samego klienta
- produkty innych linii biznesowych
- trigger moments
- CRM rules
- automated offers
## 8.3 Retention
- subscription
- recurring service
- ongoing monitoring
- maintenance
- membership
- annual service
## 8.4 Reactivation
- lost leads
- old clients
- incomplete cases
- abandoned checkout
- dormant database
## 8.5 Referral
- asking for referral
- referral timing
- referral incentive
- referral landing page
- NPS trigger
- review → referral
- partner referral
## 8.6 LTV analytics
- LTV by ICP
- LTV by acquisition channel
- LTV by salesperson
- LTV by initial product
- payback period
- cohort analysis

# people_management | 9 | PEOPLE / MANAGEMENT / OWNERSHIP | Constraint przekrojowy: czy ludzie, odpowiedzialność i rytm zarządzania pozwalają usuwać pozostałe ograniczenia? | cross
## 9.1 Ownership
- Czy każdy ważny KPI ma jednego ownera?
- Czy owner zna baseline?
- Czy owner zna target?
- Czy owner ma wpływ na KPI?
- Czy owner ma dashboard?
- Czy jest jedna osoba odpowiadająca za end-to-end wynik?
- Czy odpowiedzialność jest rozproszona?
## 9.2 Talent
- right person / right seat
- top performers
- bottom performers
- talent gaps
- seniority
- hiring pipeline
- onboarding
- time-to-productivity
## 9.3 Management
- weekly rhythm
- 1:1
- KPI reviews
- decision rights
- escalation rules
- accountability
- feedback
- coaching
## 9.4 Incentives
- salary
- commission
- bonus
- metric alignment
- gaming risk
- short-term vs long-term incentives
## 9.5 Founder / owner dependency
- sales dependency
- operational dependency
- knowledge dependency
- relationship dependency
- decision dependency
- approval dependency
## 9.6 Execution
- czy decyzje są wdrażane
- execution speed
- experiment velocity
- unfinished initiatives
- context switching
- too many priorities
`;

export type SeedConstraint = { key: string; number: number; name: string; description: string; crossCutting: boolean };
export type SeedNode = {
  key: string;
  parentKey: string | null;
  constraintKey: string;
  kind: "section" | "subsection" | "item";
  code: string | null;
  title: string;
  description: string;
  position: number;
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/</g, "lt")
    .replace(/>/g, "gt")
    .replace(/\+/g, "plus")
    .replace(/×/g, "x")
    .replace(/%/g, "pct")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseTaxonomy(text: string = TAXONOMY): { constraints: SeedConstraint[]; nodes: SeedNode[] } {
  const constraints: SeedConstraint[] = [];
  const nodes: SeedNode[] = [];
  const used = new Set<string>();
  const counters = new Map<string, number>();
  let constraint: SeedConstraint | null = null;
  let section: SeedNode | null = null;
  let subsection: SeedNode | null = null;
  let last: SeedNode | null = null;

  const add = (kind: SeedNode["kind"], rawTitle: string, parent: SeedNode | null): SeedNode => {
    if (!constraint) throw new Error("Node before constraint: " + rawTitle);
    let title = rawTitle.trim();
    let code: string | null = null;
    const m = kind === "section" ? title.match(/^(\d+\.\d+)\s+(.*)$/) : null;
    if (m) {
      code = m[1];
      title = m[2];
    }
    const parentKey = parent ? parent.key : null;
    const base = `${parentKey ?? constraint.key}/${slugify(title) || "x"}`;
    let key = base;
    for (let i = 2; used.has(key); i++) key = `${base}-${i}`;
    used.add(key);
    const counterKey = parentKey ?? constraint.key;
    const position = counters.get(counterKey) ?? 0;
    counters.set(counterKey, position + 1);
    const node: SeedNode = { key, parentKey, constraintKey: constraint.key, kind, code, title, description: "", position };
    nodes.push(node);
    return node;
  };

  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith("### ")) {
      subsection = add("subsection", l.slice(4), section);
      last = subsection;
    } else if (l.startsWith("## ")) {
      section = add("section", l.slice(3), null);
      subsection = null;
      last = section;
    } else if (l.startsWith("# ")) {
      const [key, number, name, description, flag] = l.slice(2).split("|").map((p) => p.trim());
      constraint = { key, number: Number(number), name, description, crossCutting: flag === "cross" };
      constraints.push(constraint);
      section = null;
      subsection = null;
      last = null;
    } else if (l.startsWith("> ")) {
      if (last) last.description = l.slice(2);
    } else if (l.startsWith("- ")) {
      last = add("item", l.slice(2), subsection ?? section);
    } else {
      throw new Error("Unparseable taxonomy line: " + l);
    }
  }
  return { constraints, nodes };
}
