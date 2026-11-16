# Growth Architect OS

System do diagnozowania i usuwania ograniczeń wzrostu linii biznesowych:

`BUSINESS LINE → CONSTRAINT → DIAGNOSIS → ROOT CAUSE → HYPOTHESES → EXPERIMENTS → METRIC → RESULT → NEXT CONSTRAINT`

Jedna linia = jeden MAIN CONSTRAINT = jeden aktywny Growth Cycle = max 3 aktywne hipotezy i 3 eksperymenty.
Obok Constraint Engine działa osobna soczewka diagnostyczna: **Hormozi $100M Scaling Roadmap — reconstructed framework**
(etap, graduation checklist, Constraint Alignment, Stage Debt, historia).

Architektura, schemat bazy, sitemap, user flows i wireframe'y: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind 4 · PostgreSQL (Supabase) · Supabase Auth · OpenAI (server-side).

## Uruchomienie

```bash
cp .env.example .env.local   # uzupełnij DATABASE_URL (+ Supabase, OpenAI)
npm install
npm run db:setup             # migracje + seed (idempotentne)
npm run dev
```

- `npm run db:migrate` — stosuje `db/migrations/*.sql` (śledzone w tabeli `app_migrations`).
- `npm run db:seed` — upsert taksonomii (9 constraintów, ~600 elementów) i roadmapy (10 etapów); przykładowe dane
  biznesowe wstawia tylko do pustej bazy. Dodanie linii w `db/seed/taxonomy.ts` i ponowny seed dodaje element do
  wszystkich linii bez utraty review.
- `npm test` — testy logiki roadmapy (alignment, stage debt) i parsera taksonomii.

### Logowanie

- **Supabase Auth** (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`): e-mail + hasło. W Supabase ustaw
  Site URL / Redirect URL na `<adres aplikacji>/auth/callback`. Konto z adresem `ADMIN_EMAIL` dostaje rolę Growth
  Architect; pozostałe konta zaczynają jako Viewer albo łączą się z profilem założonym wcześniej w Settings → Users
  (po potwierdzeniu adresu e-mail).
- **Bez Supabase** (lokalnie): ekran logowania pozwala wybrać użytkownika z seeda. W produkcji ten tryb jest wyłączony,
  chyba że ustawisz `ALLOW_DEV_AUTH=1`.

### Bezpieczeństwo danych

Serwer łączy się z bazą przez `DATABASE_URL`; autoryzacja (role per linia) jest egzekwowana w Server Actions i
zapytaniach. Na wszystkich tabelach włączone jest RLS bez polityk, więc klucz `anon` Supabase nie ma dostępu do danych
przez PostgREST. Klucz OpenAI nigdy nie trafia do przeglądarki.

## Ograniczenia tej wersji

- Załączniki to linki (Drive, CRM, nagrania) — bez uploadu plików do storage.
- Data Room przyjmuje TXT / CSV / TSV oraz wklejone tabele; XLSX wklej jako tabelę z arkusza.
- Odpowiedzi AI nie są streamowane (przycisk pokazuje stan „AI analizuje…”).
