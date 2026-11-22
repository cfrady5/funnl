-- Phase 2: daily NBA ingestion, play-by-play events and clip discovery.

-- Game lifecycle states as reported by providers.
alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check
  check (status in ('scheduled', 'in_progress', 'final', 'postponed', 'canceled', 'delayed', 'suspended', 'abandoned', 'unknown'));
alter table public.games
  add column if not exists status_text text,
  add column if not exists period int,
  add column if not exists postseason boolean not null default false,
  add column if not exists season int,
  add column if not exists box_verified boolean,          -- team point totals reconcile with player stats
  add column if not exists box_verification jsonb not null default '{}'::jsonb,
  add column if not exists plays_fetched_at timestamptz,
  add column if not exists pbp_reconciliation jsonb not null default '{}'::jsonb;

alter table public.teams add column if not exists full_name text;

alter table public.player_game_stats
  add column if not exists minutes_text text,
  add column if not exists steals int,
  add column if not exists blocks int,
  add column if not exists fouls int,
  add column if not exists fgm int, add column if not exists fga int,
  add column if not exists fg3m int, add column if not exists fg3a int,
  add column if not exists ftm int, add column if not exists fta int,
  add column if not exists plus_minus int,
  add column if not exists pbp_assists int,     -- assists attributed from play-by-play
  add column if not exists pbp_turnovers int,
  add column if not exists provider_stat_id text;

-- Play-by-play: every play is stored; assists/turnovers are classified in place.
alter table public.play_events
  add column if not exists sequence int,
  add column if not exists play_type text,
  add column if not exists clock_seconds numeric(6, 2),
  add column if not exists team_id uuid references public.teams (id),
  add column if not exists wallclock timestamptz,
  add column if not exists scoring_play boolean not null default false,
  add column if not exists shooting_play boolean not null default false,
  add column if not exists score_value int,
  add column if not exists home_score int,
  add column if not exists away_score int,
  add column if not exists participants text[] not null default '{}',
  add column if not exists attribution text check (attribution in ('confirmed', 'text_only', 'unresolved')),
  add column if not exists primary_name_text text,
  add column if not exists secondary_name_text text;
create index if not exists play_events_game_seq_idx on public.play_events (game_id, sequence);
create index if not exists play_events_kind_idx on public.play_events (kind, primary_player_id);

-- Every provider call, for provenance and debugging (secrets are never stored).
create table if not exists public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  params jsonb not null default '{}'::jsonb,
  http_status int,
  ok boolean not null,
  duration_ms int,
  payload jsonb,
  payload_sha256 text,
  error text,
  workflow_run_id uuid references public.workflow_runs (id) on delete set null,
  retrieved_at timestamptz not null default now()
);
create index if not exists provider_requests_run_idx on public.provider_requests (workflow_run_id);
create index if not exists provider_requests_at_idx on public.provider_requests (retrieved_at desc);

-- Discovered clip references (discovery ≠ acquisition ≠ publication rights).
create table if not exists public.clip_references (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  game_id uuid references public.games (id) on delete cascade,
  provider_game_key text,
  granularity text not null check (granularity in ('play', 'game')),
  title text,
  url text,
  embed_url text,
  thumbnail_url text,
  source_platform text,
  source_account text,
  posted_at timestamptz,
  provider_confidence text,
  matched_play jsonb,
  display text not null check (display in ('embed_only', 'link_only', 'file')),
  acquisition text not null check (acquisition in ('none', 'licensed_download')),
  raw jsonb,
  retrieved_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index if not exists clip_references_game_idx on public.clip_references (game_id);

create table if not exists public.play_clip_links (
  play_event_id uuid not null references public.play_events (id) on delete cascade,
  clip_reference_id uuid not null references public.clip_references (id) on delete cascade,
  score numeric(3, 2) not null check (score between 0 and 1),
  level text not null check (level in ('strong', 'probable', 'weak')),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (play_event_id, clip_reference_id)
);

-- Ranking snapshot per run (frozen at ingestion time).
create table if not exists public.daily_leaders (
  workflow_run_id uuid not null references public.workflow_runs (id) on delete cascade,
  game_date date not null,
  category text not null check (category in ('assists', 'turnovers')),
  rank int not null check (rank between 1 and 50),
  player_id uuid not null references public.players (id),
  game_id uuid not null references public.games (id),
  value int not null,
  created_at timestamptz not null default now(),
  primary key (workflow_run_id, category, rank)
);
create index if not exists daily_leaders_date_idx on public.daily_leaders (game_date, category, rank);

alter table public.candidate_clips
  add column if not exists player_id uuid references public.players (id),
  add column if not exists game_id uuid references public.games (id),
  add column if not exists game_date date,
  add column if not exists best_clip_reference_id uuid references public.clip_references (id) on delete set null,
  add column if not exists project_ref text; -- id of the video project created from this candidate
create unique index if not exists candidate_clips_event_brand on public.candidate_clips (play_event_id, brand) where play_event_id is not null;
create index if not exists candidate_clips_date_idx on public.candidate_clips (game_date, brand, suitability_score desc);

alter table public.workflow_runs
  add column if not exists summary jsonb not null default '{}'::jsonb,
  add column if not exists error text,
  add column if not exists attempt int not null default 1;
alter table public.workflow_steps
  add column if not exists error text,
  add column if not exists position int not null default 0;

-- RLS for new tables: team members read; writes go through the service role (workers).
do $$
declare t text;
begin
  foreach t in array array['provider_requests', 'clip_references', 'play_clip_links', 'daily_leaders']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_role(''viewer''))', t || '_read', t);
  end loop;
end $$;
-- Raw provider payloads are admin-only.
drop policy if exists provider_requests_read on public.provider_requests;
create policy provider_requests_read on public.provider_requests for select to authenticated using (public.has_role('admin'));
