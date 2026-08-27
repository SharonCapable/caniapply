-- ============================================================
-- ApplyIQ v2 — Supabase Schema
-- Paste this into Supabase → SQL Editor → Run.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- CORE TABLES (application sessions)
-- ============================================================

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null default 'New Application',
  job_description text,
  company_name text,
  company_insights text,
  selected_cv_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists cvs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- A CV attached to a session is either an upload or a snapshot of a Living CV.
alter table cvs add column if not exists source text not null default 'upload';
alter table cvs add column if not exists living_cv_id uuid;

-- ============================================================
-- CAREER INTELLIGENCE TABLES
-- ============================================================

-- Daily work log entries (voice or text)
create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  logged_at date not null default current_date,
  raw_text text not null,
  ai_summary text,
  skills_extracted jsonb default '[]'::jsonb,
  domains jsonb default '[]'::jsonb,
  -- Context: personal | client | company
  context_type text check (context_type in ('personal', 'client', 'company')),
  context_name text,
  impact_statement text,
  created_at timestamptz default now()
);

-- Aggregated skill ledger (upserted after each work log)
create table if not exists skill_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  skill text not null,
  domain text,
  first_seen date,
  last_seen date,
  occurrence_count int default 1,
  recency_score float default 1.0,
  proficiency_estimate text default 'intermediate',
  proficiency_override text,          -- manual override, takes precedence
  updated_at timestamptz default now()
);

-- Normalised key so "PostGIS" / "postgis" / "Post GIS" collapse into one skill,
-- and a domain array so a skill used in both product AND geospatial keeps both.
alter table skill_ledger add column if not exists skill_key text;
alter table skill_ledger add column if not exists domains jsonb default '[]'::jsonb;

-- Backfill skill_key for rows written before this column existed.
update skill_ledger
   set skill_key = btrim(regexp_replace(
                     regexp_replace(lower(skill), '[._/\-]+', ' ', 'g'),
                     '\s+', ' ', 'g'))
 where skill_key is null;

update skill_ledger
   set domains = to_jsonb(array[domain])
 where domain is not null
   and (domains is null or domains = '[]'::jsonb);

-- Collapse duplicates that predate the normalised key (keep the highest count)
-- so the unique index below can be created.
delete from skill_ledger a
 using skill_ledger b
 where a.user_id = b.user_id
   and a.skill_key = b.skill_key
   and (a.occurrence_count, a.id) < (b.occurrence_count, b.id);

alter table skill_ledger alter column skill_key set not null;

create unique index if not exists skill_ledger_user_skill_key_uidx
  on skill_ledger(user_id, skill_key);

-- Living CVs (AI-generated, domain-specific, regenerated in place)
create table if not exists living_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  domain text,
  context_filter jsonb default '[]'::jsonb,  -- filter by context_name
  generated_text text not null,
  last_generated_at timestamptz default now(),
  is_pinned boolean default false,
  created_at timestamptz default now()
);

alter table cvs drop constraint if exists cvs_living_cv_id_fkey;
alter table cvs add constraint cvs_living_cv_id_fkey
  foreign key (living_cv_id) references living_cvs(id) on delete set null;

-- One snapshot per Living CV per session — re-attaching refreshes it in place.
create unique index if not exists cvs_session_living_uidx
  on cvs(session_id, living_cv_id) where living_cv_id is not null;

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_updated_at_idx on sessions(updated_at desc);
create index if not exists cvs_session_id_idx on cvs(session_id);
create index if not exists messages_session_id_idx on messages(session_id);
create index if not exists work_logs_user_id_idx on work_logs(user_id);
create index if not exists work_logs_logged_at_idx on work_logs(user_id, logged_at desc);
create index if not exists work_logs_created_at_idx on work_logs(user_id, created_at desc);
create index if not exists work_logs_domains_gin on work_logs using gin (domains);
create index if not exists skill_ledger_user_id_idx on skill_ledger(user_id);
create index if not exists skill_ledger_domains_gin on skill_ledger using gin (domains);
create index if not exists living_cvs_user_id_idx on living_cvs(user_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================

create or replace function update_updated_at()
returns trigger as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$ language plpgsql;

drop trigger if exists sessions_updated_at on sessions;
create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

drop trigger if exists skill_ledger_updated_at on skill_ledger;
create trigger skill_ledger_updated_at
  before update on skill_ledger
  for each row execute function update_updated_at();

-- ============================================================
-- BACKFILL user_id ON PRE-AUTH ROWS
-- ------------------------------------------------------------
-- Rows created before login existed have user_id = NULL and go invisible the
-- moment RLS is enabled below. Claim them by putting your account email on the
-- claim_email line, then re-running this file. Leave it as-is to skip.
-- ============================================================

do $backfill$
declare
  claim_email text := 'CHANGE_ME@example.com';
  claim_id uuid;
begin
  select id into claim_id from auth.users where email = claim_email;

  if claim_id is not null then
    update sessions set user_id = claim_id where user_id is null;
    update cvs      set user_id = claim_id where user_id is null;
    update messages set user_id = claim_id where user_id is null;
    raise notice 'Backfilled orphaned rows to %', claim_email;
  end if;
end
$backfill$;

-- ============================================================
-- ROW LEVEL SECURITY (each account sees only its own data)
-- ============================================================

alter table sessions     enable row level security;
alter table cvs          enable row level security;
alter table messages     enable row level security;
alter table work_logs    enable row level security;
alter table skill_ledger enable row level security;
alter table living_cvs   enable row level security;

drop policy if exists "sessions_user" on sessions;
create policy "sessions_user" on sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cvs_user" on cvs;
create policy "cvs_user" on cvs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "messages_user" on messages;
create policy "messages_user" on messages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "work_logs_user" on work_logs;
create policy "work_logs_user" on work_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "skill_ledger_user" on skill_ledger;
create policy "skill_ledger_user" on skill_ledger for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "living_cvs_user" on living_cvs;
create policy "living_cvs_user" on living_cvs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
