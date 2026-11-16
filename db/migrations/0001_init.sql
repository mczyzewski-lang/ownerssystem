-- GROWTH ARCHITECT OS — initial schema
-- Works on Supabase Postgres and plain PostgreSQL 14+.
-- The Next.js server talks to the database over DATABASE_URL (server-side only).
-- RLS is enabled on every table WITHOUT policies, so the Supabase anon/authenticated
-- API keys cannot read or write anything through PostgREST. Authorization lives in the server.

create extension if not exists pgcrypto;

-- ───────────────────────── users & business lines ─────────────────────────

create table users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique,                       -- supabase auth.users.id (linked on first login)
  email       text not null unique,
  name        text not null,
  role        text not null default 'viewer' check (role in ('growth_architect','business_owner','viewer')),
  created_at  timestamptz not null default now()
);

create table business_lines (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  group_name          text not null default 'Osobne spółki / marki',
  description         text not null default '',
  owner_id            uuid references users(id) on delete set null,
  growth_architect_id uuid references users(id) on delete set null,
  headcount           integer,                   -- signal only, used for structural Hormozi stage
  position            integer not null default 0,
  archived_at         timestamptz,
  created_at          timestamptz not null default now()
);

create table business_members (
  business_line_id uuid not null references business_lines(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  role             text not null default 'viewer' check (role in ('growth_architect','business_owner','viewer')),
  primary key (business_line_id, user_id)
);

-- ───────────────────────── constraint taxonomy (global template) ─────────────────────────

create table constraints (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  number        integer not null,
  name          text not null,
  description   text not null default '',
  cross_cutting boolean not null default false
);

create table checklist_nodes (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,            -- stable path key, lets the template evolve without losing reviews
  constraint_id uuid not null references constraints(id) on delete cascade,
  parent_id     uuid references checklist_nodes(id) on delete cascade,
  kind          text not null check (kind in ('section','subsection','item')),
  code          text,
  title         text not null,
  description   text not null default '',
  position      integer not null default 0,
  archived_at   timestamptz
);
create index on checklist_nodes (constraint_id, parent_id, position);

-- ───────────────────────── per-business-line reviews ─────────────────────────

create table constraint_reviews (
  business_line_id uuid not null references business_lines(id) on delete cascade,
  constraint_id    uuid not null references constraints(id) on delete cascade,
  status           text not null default 'not_reviewed'
                   check (status in ('not_reviewed','healthy','watch','candidate','main','resolved')),
  score            integer check (score between 1 and 10),
  evidence         text not null default '',
  data_notes       text not null default '',
  owner_id         uuid references users(id) on delete set null,
  last_reviewed_at timestamptz,
  primary key (business_line_id, constraint_id)
);
-- Only ONE active MAIN CONSTRAINT per business line.
create unique index one_main_constraint_per_line on constraint_reviews (business_line_id) where status = 'main';

create table constraint_status_history (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  constraint_id    uuid not null references constraints(id) on delete cascade,
  from_status      text,
  to_status        text not null,
  reason           text not null default '',
  changed_by       uuid references users(id) on delete set null,
  changed_at       timestamptz not null default now()
);
create index on constraint_status_history (business_line_id, changed_at desc);

create table checklist_reviews (
  business_line_id uuid not null references business_lines(id) on delete cascade,
  node_id          uuid not null references checklist_nodes(id) on delete cascade,
  status           text not null default 'not_reviewed'
                   check (status in ('not_reviewed','healthy','concern','candidate')),
  checked          boolean not null default false,
  note             text not null default '',
  evidence         text not null default '',
  link             text not null default '',
  metric           text not null default '',
  owner_id         uuid references users(id) on delete set null,
  updated_by       uuid references users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  primary key (business_line_id, node_id)
);

-- ───────────────────────── comments (every level) ─────────────────────────

create table comments (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  target_type      text not null,   -- business_line | constraint | node | hypothesis | experiment | cycle | decision | roadmap_item
  target_id        uuid not null,
  parent_id        uuid references comments(id) on delete cascade,
  kind             text not null default 'comment' check (kind in ('comment','question','data_request')),
  author_id        uuid references users(id) on delete set null,
  body             text not null,
  mentions         uuid[] not null default '{}',
  status           text not null default 'open' check (status in ('open','resolved')),
  created_at       timestamptz not null default now(),
  edited_at        timestamptz
);
create index on comments (business_line_id, target_type, target_id);

create table comment_edits (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  body       text not null,           -- body BEFORE the edit
  edited_by  uuid references users(id) on delete set null,
  edited_at  timestamptz not null default now()
);

create table attachments (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  target_type      text not null,
  target_id        uuid not null,
  name             text not null,
  url              text not null,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index on attachments (business_line_id, target_type, target_id);

-- ───────────────────────── growth cycles, hypotheses, experiments ─────────────────────────

create table growth_cycles (
  id                   uuid primary key default gen_random_uuid(),
  business_line_id     uuid not null references business_lines(id) on delete cascade,
  name                 text not null,
  start_date           date,
  end_date             date,
  constraint_id        uuid references constraints(id) on delete set null,
  primary_metric       text not null default '',
  baseline             text not null default '',
  target               text not null default '',
  economic_upside      text not null default '',
  confidence           text not null default 'medium' check (confidence in ('high','medium','low')),
  owner_id             uuid references users(id) on delete set null,
  root_causes          text not null default '',
  condition_of_victory text not null default '',
  status               text not null default 'planned' check (status in ('planned','active','completed','abandoned')),
  result               text not null default '',
  retrospective        text not null default '',
  created_at           timestamptz not null default now()
);
-- Only ONE active Growth Cycle (= one strategic priority) per business line.
create unique index one_active_cycle_per_line on growth_cycles (business_line_id) where status = 'active';

create table hypotheses (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  constraint_id    uuid references constraints(id) on delete set null,
  node_id          uuid references checklist_nodes(id) on delete set null,  -- subcategory
  cycle_id         uuid references growth_cycles(id) on delete set null,    -- set = active in that cycle
  statement        text not null,
  expected_impact  text not null default '',
  impact           integer not null default 5 check (impact between 1 and 10),
  confidence       integer not null default 5 check (confidence between 1 and 10),
  effort           integer not null default 5 check (effort between 1 and 10),
  speed            integer not null default 5 check (speed between 1 and 10),
  time_to_learn    text not null default '',
  economic_upside  text not null default '',
  owner_id         uuid references users(id) on delete set null,
  status           text not null default 'idea'
                   check (status in ('idea','backlog','prioritized','testing','won','lost','inconclusive','implemented')),
  result           text not null default '',
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index on hypotheses (business_line_id, status);

create table hypothesis_node_links (
  hypothesis_id uuid not null references hypotheses(id) on delete cascade,
  node_id       uuid not null references checklist_nodes(id) on delete cascade,
  primary key (hypothesis_id, node_id)
);

create table experiments (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  hypothesis_id    uuid not null references hypotheses(id) on delete cascade,
  cycle_id         uuid references growth_cycles(id) on delete set null,
  name             text not null,
  design           text not null default '',
  metric           text not null default '',
  baseline         text not null default '',
  target           text not null default '',
  start_date       date,
  deadline         date,
  owner_id         uuid references users(id) on delete set null,
  status           text not null default 'planned' check (status in ('planned','running','completed','stopped')),
  result           text not null default '',
  created_at       timestamptz not null default now()
);

-- ───────────────────────── funnel, metrics, data room ─────────────────────────

create table funnel_definitions (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  name             text not null default 'Main funnel',
  created_at       timestamptz not null default now()
);

create table funnel_steps (
  id        uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references funnel_definitions(id) on delete cascade,
  name      text not null,
  position  integer not null default 0
);

create table funnel_data (
  id           uuid primary key default gen_random_uuid(),
  funnel_id    uuid not null references funnel_definitions(id) on delete cascade,
  step_id      uuid not null references funnel_steps(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  segment      text not null default '',
  source       text not null default '',
  volume       numeric not null default 0,
  revenue      numeric,
  unique (step_id, period_start, period_end, segment, source)
);

create table metrics (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  constraint_id    uuid references constraints(id) on delete set null,
  name             text not null,
  value            text not null,
  unit             text not null default '',
  period_start     date,
  period_end       date,
  source           text not null default '',
  note             text not null default '',
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table data_imports (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  name             text not null,
  kind             text not null default 'raw_text',  -- raw_text | table | funnel_results | business_description | file
  import_date      date not null default current_date,
  source           text not null default '',
  description      text not null default '',
  filename         text,
  raw_content      text not null,                     -- never modified after insert
  parsed_content   jsonb,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ───────────────────────── decisions ─────────────────────────

create table decisions (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  decision_date    date not null default current_date,
  decision         text not null,
  why              text not null default '',
  evidence         text not null default '',
  owner_id         uuid references users(id) on delete set null,
  expected_result  text not null default '',
  review_date      date,
  result           text not null default '',
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ───────────────────────── AI conversations ─────────────────────────

create table ai_conversations (
  id                  uuid primary key default gen_random_uuid(),
  business_line_id    uuid not null references business_lines(id) on delete cascade,
  title               text not null,
  action              text,                         -- which AI action started it (null = free chat)
  constraint_snapshot text not null default '',     -- Primary Constraint at that time
  cycle_id            uuid references growth_cycles(id) on delete set null,
  cycle_snapshot      text not null default '',
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  author_id       uuid references users(id) on delete set null,
  content         text not null,
  created_at      timestamptz not null default now()
);
create index on ai_messages (conversation_id, created_at);

-- ───────────────────────── Hormozi $100M Scaling Roadmap (reconstructed framework) ─────────────────────────
-- A separate diagnostic lens. It never drives the Constraint Engine automatically.

create table roadmap_stages (
  number                integer primary key check (number between 0 and 9),
  key                   text not null unique,
  name                  text not null,
  role                  text not null,
  headcount_label       text not null,
  headcount_min         integer not null,
  headcount_max         integer,
  main_constraint       text not null,
  typical_constraint    text not null,              -- short label used in the alignment matrix
  typical_symptom       text not null default '',
  graduate_by           text not null,
  question              text not null,
  note                  text not null default '',
  guidance              jsonb not null default '[]', -- [{area, items[]}]
  strong_signals        jsonb not null default '[]',
  primary_constraints   text[] not null default '{}', -- constraint keys = strong alignment
  secondary_constraints text[] not null default '{}', -- constraint keys = partial alignment
  mismatch_question     text not null default ''
);

create table roadmap_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  stage_number integer not null references roadmap_stages(number) on delete cascade,
  text         text not null,
  position     integer not null default 0,
  archived_at  timestamptz
);

create table roadmap_checklist_reviews (
  business_line_id uuid not null references business_lines(id) on delete cascade,
  item_id          uuid not null references roadmap_checklist_items(id) on delete cascade,
  status           text not null default 'not_reviewed' check (status in ('not_reviewed','pass','fail')),
  comment          text not null default '',
  evidence         text not null default '',
  metric           text not null default '',
  owner_id         uuid references users(id) on delete set null,
  updated_by       uuid references users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  primary key (business_line_id, item_id)
);

-- Roadmap history: every stage decision / AI proposal for a business line.
create table stage_assessments (
  id               uuid primary key default gen_random_uuid(),
  business_line_id uuid not null references business_lines(id) on delete cascade,
  stage_number     integer not null references roadmap_stages(number),
  assessed_on      date not null default current_date,
  source           text not null check (source in ('ai','manual')),
  status           text not null default 'accepted' check (status in ('proposed','accepted','rejected')),
  manual_override  boolean not null default false,  -- accepted stage differs from what AI proposed
  confidence       integer check (confidence between 0 and 100),
  reason           text not null default '',
  evidence         text not null default '',
  ai_assessment    jsonb,                           -- full structured AI answer
  author_id        uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index on stage_assessments (business_line_id, assessed_on desc, created_at desc);

-- ───────────────────────── lock everything down for PostgREST ─────────────────────────

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
