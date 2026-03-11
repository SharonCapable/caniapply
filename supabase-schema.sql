-- ============================================================
-- ApplyIQ — Supabase Schema
-- Paste this into Supabase → SQL Editor → Run
-- ============================================================

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
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
  name text not null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists sessions_updated_at_idx on sessions(updated_at desc);
create index if not exists cvs_session_id_idx on cvs(session_id);
create index if not exists messages_session_id_idx on messages(session_id);

-- Auto-update updated_at on sessions
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_updated_at on sessions;
create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();
