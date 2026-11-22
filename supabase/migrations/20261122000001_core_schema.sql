-- Tiresias Content Engine — core schema
-- Target: Supabase Postgres 15+. Requires the `auth` schema (provided by Supabase).
-- Conventions: uuid PKs, timestamptz, snake_case, every table has created_at;
-- mutable tables have updated_at maintained by trigger.

-- gen_random_uuid() is built into Postgres 13+; no extension required.

-- ───────────────────────────── enums ─────────────────────────────
create type public.app_role as enum ('admin', 'editor', 'viewer');
create type public.brand_id as enum ('tiresias', 'antitiresias');
create type public.content_status as enum (
  'discovered', 'awaiting_footage', 'analyzing', 'needs_review', 'ready_to_render', 'rendering',
  'ready_for_approval', 'approved', 'scheduled', 'published', 'failed', 'rejected'
);
create type public.rights_status as enum ('owned', 'licensed', 'permission_granted', 'public_domain', 'unknown', 'restricted', 'expired');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.platform as enum ('tiktok', 'instagram', 'youtube');
create type public.option_label as enum ('A', 'B', 'C', 'D');
create type public.event_kind as enum ('assist', 'turnover', 'pass', 'other');

-- ───────────────────────────── helpers ─────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────────── users & roles ─────────────────────────────
create table public.app_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.app_users where user_id = auth.uid()
$$;

create or replace function public.has_role(min_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    case min_role
      when 'viewer' then public.current_app_role() in ('viewer', 'editor', 'admin')
      when 'editor' then public.current_app_role() in ('editor', 'admin')
      when 'admin'  then public.current_app_role() = 'admin'
    end, false)
$$;

-- ───────────────────────────── reference data ─────────────────────────────
create table public.brands (
  id public.brand_id primary key,
  name text not null,
  tagline text not null,
  series_title text not null,
  theme jsonb not null default '{}'::jsonb,
  style_guide jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  daily_quota int not null check (daily_quota between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_team_id text not null,
  abbreviation text not null check (char_length(abbreviation) between 2 and 4),
  name text not null,
  city text,
  colors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_team_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_player_id text not null,
  full_name text not null,
  team_id uuid references public.teams (id) on delete set null,
  jersey text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_player_id)
);
create index players_team_idx on public.players (team_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_game_id text not null,
  game_date date not null, -- NBA calendar date (America/New_York)
  tipoff_at timestamptz,
  home_team_id uuid not null references public.teams (id),
  away_team_id uuid not null references public.teams (id),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'final', 'postponed', 'unknown')),
  home_score int,
  away_score int,
  data_complete boolean not null default false,
  source_url text,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_game_id),
  check (home_team_id <> away_team_id)
);
create index games_date_idx on public.games (game_date);

create table public.player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  minutes numeric(5, 2),
  points int check (points >= 0),
  assists int not null check (assists >= 0),
  turnovers int check (turnovers >= 0),
  rebounds int check (rebounds >= 0),
  raw jsonb not null default '{}'::jsonb,
  provider text not null,
  retrieved_at timestamptz not null,
  verified boolean not null default false, -- totals reconciled against provider
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);
create index pgs_assists_idx on public.player_game_stats (game_id, assists desc);

create table public.play_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  kind public.event_kind not null,
  period int not null check (period between 1 and 10),
  clock text,
  primary_player_id uuid references public.players (id),
  secondary_player_id uuid references public.players (id), -- e.g. scorer for an assist
  description text,
  raw jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (game_id, provider, provider_event_id)
);
create index play_events_player_idx on public.play_events (primary_player_id, kind);

-- ───────────────────────────── media & rights ─────────────────────────────
create table public.media_rights (
  id uuid primary key default gen_random_uuid(),
  status public.rights_status not null default 'unknown',
  source_provider text not null,
  source_url text,
  source_identifier text,
  rights_holder text,
  license_reference text,
  allowed_uses text[] not null default array['internal_preview'],
  redistribution_permitted boolean not null default false,
  attribution_required boolean not null default false,
  attribution_text text,
  expires_at timestamptz,
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allowed_uses <@ array['internal_preview', 'social_publication', 'commercial']),
  check (not attribution_required or attribution_text is not null or status = 'unknown')
);

create table public.video_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'image', 'audio')),
  storage_bucket text not null default 'media',
  original_path text not null,
  normalized_path text,
  poster_path text,
  original_name text not null,
  bytes bigint not null check (bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  probe jsonb,
  rights_id uuid not null references public.media_rights (id),
  play_event_id uuid references public.play_events (id) on delete set null,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sha256) -- duplicate asset detection
);
create index video_sources_rights_idx on public.video_sources (rights_id);

-- ───────────────────────────── discovery & analysis ─────────────────────────────
create table public.candidate_clips (
  id uuid primary key default gen_random_uuid(),
  play_event_id uuid references public.play_events (id) on delete cascade,
  video_source_id uuid references public.video_sources (id) on delete set null,
  brand public.brand_id not null,
  discovery_provider text not null,
  discovery_reference text,
  suitability_score numeric(5, 2) check (suitability_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  score_coverage numeric(3, 2) check (score_coverage between 0 and 1),
  status text not null default 'discovered' check (status in ('discovered', 'awaiting_footage', 'scored', 'selected', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidate_clips_score_idx on public.candidate_clips (brand, suitability_score desc);

create table public.clip_analysis (
  id uuid primary key default gen_random_uuid(),
  video_source_id uuid not null references public.video_sources (id) on delete cascade,
  analyzer text not null,
  analyzer_version text not null,
  input_hash text not null, -- cache key: same input + version => reuse
  camera_cuts numeric[] not null default '{}',
  decision_frame_candidates jsonb not null default '[]'::jsonb,
  detections_path text, -- large per-frame detections live in storage, not rows
  confidence numeric(3, 2) check (confidence between 0 and 1),
  needs_manual_review boolean not null default true,
  created_at timestamptz not null default now(),
  unique (video_source_id, analyzer, analyzer_version, input_hash)
);

-- ───────────────────────────── production ─────────────────────────────
create table public.video_projects (
  id uuid primary key default gen_random_uuid(),
  brand public.brand_id not null references public.brands (id),
  content_id text not null unique,
  title text not null,
  status public.content_status not null default 'needs_review',
  video_source_id uuid not null references public.video_sources (id),
  candidate_clip_id uuid references public.candidate_clips (id) on delete set null,
  player_id uuid references public.players (id),
  game_id uuid references public.games (id),
  spec jsonb not null, -- VideoSpec (validated by @tiresias/core before write)
  cover_overrides jsonb not null default '{}'::jsonb,
  headshot_source_id uuid references public.video_sources (id),
  game_date date,
  workflow_run_id uuid,
  notes text,
  created_by uuid references auth.users (id),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or approved_at is not null)
);
create index video_projects_status_idx on public.video_projects (status, updated_at desc);
create index video_projects_date_idx on public.video_projects (game_date, brand);

create table public.passing_options (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  label public.option_label not null,
  description text not null check (char_length(description) <= 48),
  x numeric(6, 5) not null check (x between 0 and 1),
  y numeric(6, 5) not null check (y between 0 and 1),
  frame_index int not null check (frame_index >= 0),
  player_id uuid references public.players (id),
  origin text not null check (origin in ('manual', 'auto')),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  visible boolean not null default true,
  reasoning text,
  is_actual boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, label)
);
create unique index passing_options_one_actual on public.passing_options (project_id) where is_actual;

create table public.video_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  scene text not null check (scene in ('hook', 'decision', 'countdown', 'reveal', 'explanation', 'outro')),
  start_frame int not null check (start_frame >= 0),
  duration_frames int not null check (duration_frames > 0),
  config jsonb not null default '{}'::jsonb,
  unique (project_id, scene)
);

create table public.rendered_videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  status public.job_status not null default 'queued',
  progress numeric(4, 3) not null default 0 check (progress between 0 and 1),
  video_path text,
  contact_sheet_path text,
  spec_snapshot jsonb, -- the exact config that produced this render
  spec_hash text,
  qa_report jsonb,
  qa_passed boolean,
  width int,
  height int,
  duration_sec numeric(6, 3),
  bytes bigint,
  render_ms int,
  cost_usd numeric(10, 5),
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index rendered_videos_project_idx on public.rendered_videos (project_id, created_at desc);

create table public.cover_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  rendered_video_id uuid references public.rendered_videos (id) on delete cascade,
  image_path text not null,
  headshot_source_id uuid references public.video_sources (id),
  template text not null,
  qa_report jsonb,
  created_at timestamptz not null default now()
);

create table public.content_captions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  platform public.platform not null,
  title text,
  caption text not null,
  hashtags text[] not null default '{}',
  grounding jsonb not null default '[]'::jsonb, -- facts each claim is based on
  validation jsonb not null default '{}'::jsonb,
  generated_by text not null check (generated_by in ('human', 'llm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, platform)
);

-- ───────────────────────────── publishing ─────────────────────────────
-- Tokens are NEVER stored in this table: credential_secret_id points at a
-- Supabase Vault secret that only the service role can decrypt.
create table public.publishing_accounts (
  id uuid primary key default gen_random_uuid(),
  platform public.platform not null,
  brand public.brand_id not null references public.brands (id),
  account_handle text not null,
  external_account_id text,
  scopes text[] not null default '{}',
  audit_status text not null default 'unaudited' check (audit_status in ('unaudited', 'pending', 'approved', 'rejected')),
  credential_secret_id uuid, -- vault.secrets.id
  token_expires_at timestamptz,
  connected boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, brand, account_handle)
);

create table public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete restrict,
  rendered_video_id uuid not null references public.rendered_videos (id),
  account_id uuid not null references public.publishing_accounts (id),
  mode text not null check (mode in ('manual', 'approval_required', 'automatic')),
  scheduled_for timestamptz,
  status public.job_status not null default 'queued',
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts between 1 and 10),
  idempotency_key text not null unique,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publishing_jobs_due_idx on public.publishing_jobs (status, scheduled_for);

create table public.platform_posts (
  id uuid primary key default gen_random_uuid(),
  publishing_job_id uuid not null references public.publishing_jobs (id),
  project_id uuid not null references public.video_projects (id),
  account_id uuid not null references public.publishing_accounts (id),
  platform public.platform not null,
  external_post_id text,
  url text,
  visibility text,
  state text not null check (state in ('uploading', 'processing', 'published', 'failed', 'removed')),
  published_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_post_id)
);
-- One live post per project per account: prevents duplicate publication.
create unique index platform_posts_no_dupes on public.platform_posts (project_id, account_id) where state in ('uploading', 'processing', 'published');

create table public.engagement_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.platform_posts (id) on delete cascade,
  captured_at timestamptz not null,
  views bigint check (views >= 0),
  likes bigint check (likes >= 0),
  comments bigint check (comments >= 0),
  shares bigint check (shares >= 0),
  avg_watch_sec numeric(8, 2),
  completion_rate numeric(5, 4) check (completion_rate between 0 and 1),
  raw jsonb not null default '{}'::jsonb,
  unique (post_id, captured_at)
);

-- ───────────────────────────── workflows, jobs, observability ─────────────────────────────
create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow text not null,
  brand public.brand_id,
  game_date date,
  idempotency_key text not null unique, -- e.g. daily:tiresias:2026-11-21
  status public.job_status not null default 'queued',
  trigger text not null check (trigger in ('schedule', 'manual', 'retry')),
  incomplete_reason text, -- flagged when data was delayed/incomplete
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.video_projects add constraint video_projects_run_fk foreign key (workflow_run_id) references public.workflow_runs (id) on delete set null;

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs (id) on delete cascade,
  step text not null,
  status public.job_status not null default 'queued',
  attempts int not null default 0,
  checkpoint jsonb not null default '{}'::jsonb, -- resumable state
  output jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, step)
);

-- Worker queue (render, ingest, analysis, publish…)
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'queued',
  idempotency_key text,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts between 1 and 10),
  progress numeric(4, 3) not null default 0 check (progress between 0 and 1),
  run_after timestamptz not null default now(),
  cancel_requested boolean not null default false,
  locked_by text,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create unique index jobs_idempotency on public.jobs (idempotency_key) where idempotency_key is not null and status not in ('failed', 'cancelled');
create index jobs_runnable_idx on public.jobs (status, run_after) where status = 'queued';

-- Atomically claim the next runnable job (safe with many workers).
create or replace function public.claim_next_job(worker text, job_types text[] default null)
returns public.jobs language plpgsql as $$
declare j public.jobs;
begin
  select * into j from public.jobs
   where status = 'queued' and not cancel_requested and run_after <= now()
     and (job_types is null or type = any (job_types))
   order by created_at
   for update skip locked
   limit 1;
  if not found then return null; end if;
  update public.jobs set status = 'running', attempts = attempts + 1, locked_by = worker, locked_at = now(), started_at = now(), progress = 0
   where id = j.id returning * into j;
  return j;
end $$;

create table public.job_errors (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete cascade,
  workflow_step_id uuid references public.workflow_steps (id) on delete cascade,
  attempt int not null,
  error_class text,
  message text not null,
  retryable boolean not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.video_projects (id) on delete set null,
  workflow_run_id uuid references public.workflow_runs (id) on delete set null,
  provider text not null,
  model text not null,
  purpose text not null,
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cache_read_tokens int not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  cached_result boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_usage_day_idx on public.ai_usage (created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users (id),
  actor_kind text not null default 'user' check (actor_kind in ('user', 'worker', 'system')),
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  scope text not null,
  action text not null,
  entity_type text,
  entity_id text,
  data jsonb not null default '{}'::jsonb -- must be redacted before insert
);
create index audit_logs_at_idx on public.audit_logs (at desc);

create table public.app_settings (
  id boolean primary key default true check (id), -- singleton row
  timezone text not null default 'America/New_York',
  daily_run_time time not null default '08:00',
  selection_mode text not null default 'one_per_player' check (selection_mode in ('one_per_player', 'best_from_pool')),
  automation_level text not null default 'approval_required' check (automation_level in ('manual', 'approval_required', 'automatic')),
  min_quality_score numeric(5, 2) not null default 60,
  daily_budget_usd numeric(10, 2) not null default 5,
  monthly_budget_usd numeric(10, 2) not null default 100,
  worker_cost_per_hour_usd numeric(10, 4) not null default 0.10,
  max_job_attempts int not null default 3,
  retention_days_renders int not null default 30,
  retention_days_sources int not null default 90,
  updated_at timestamptz not null default now()
);

-- Daily spend (render compute + AI) for budget enforcement.
create view public.daily_costs with (security_invoker = true) as
  select day, sum(render_usd) as render_usd, sum(ai_usd) as ai_usd, sum(render_usd) + sum(ai_usd) as total_usd
  from (
    select date_trunc('day', finished_at at time zone 'America/New_York')::date as day, coalesce(cost_usd, 0) as render_usd, 0::numeric as ai_usd from public.rendered_videos where finished_at is not null
    union all
    select date_trunc('day', created_at at time zone 'America/New_York')::date, 0, cost_usd from public.ai_usage
  ) c
  group by day;

-- ───────────────────────────── updated_at triggers ─────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['app_users', 'brands', 'teams', 'players', 'games', 'media_rights', 'video_sources', 'candidate_clips',
    'video_projects', 'content_captions', 'publishing_accounts', 'publishing_jobs', 'platform_posts', 'app_settings']
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
