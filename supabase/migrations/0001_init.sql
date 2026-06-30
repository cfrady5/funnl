-- ============================================================================
-- SEM Command Center — initial schema
-- ============================================================================
-- Run order: 0001_init.sql then 0002_rls.sql
-- Apply via the Supabase SQL editor, or: supabase db push
--
-- Conventions:
--   * UUID primary keys (gen_random_uuid()).
--   * `profiles.id` mirrors auth.users.id (Supabase Auth).
--   * Monetary values: budgets/customer value in whole currency units;
--     Google Ads cost stored in micros (1,000,000 = 1 unit) as in the API.
--   * jsonb columns hold flexible, API-shaped sub-objects.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- profiles (1:1 with auth.users) ----------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- businesses -------------------------------------------------------------
create table if not exists public.businesses (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  business_name           text not null,
  website_url             text not null,
  industry                text,
  primary_location        text,
  monthly_ad_budget       numeric,
  primary_conversion_goal text,
  average_customer_value  numeric,
  profitable_services     jsonb not null default '[]'::jsonb,
  target_locations        jsonb not null default '[]'::jsonb,
  ad_status               text not null default 'unknown',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists businesses_user_id_idx on public.businesses (user_id);

-- --- google_integrations ----------------------------------------------------
-- One row per (user, provider). Tokens encrypted at the app layer (AES-256-GCM)
-- before insert — the DB never sees plaintext refresh tokens.
create table if not exists public.google_integrations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  provider                text not null,  -- google_ads | ga4 | search_console | gtm
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  scopes                  jsonb not null default '[]'::jsonb,
  connected_at            timestamptz,
  last_sync_at            timestamptz,
  status                  text not null default 'disconnected',
  unique (user_id, provider)
);
create index if not exists google_integrations_user_idx on public.google_integrations (user_id);

-- --- selected_google_accounts ----------------------------------------------
create table if not exists public.selected_google_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  business_id              uuid references public.businesses (id) on delete cascade,
  google_ads_customer_id   text,
  ga4_property_id          text,
  search_console_site_url  text,
  gtm_account_id           text,
  gtm_container_id         text,
  gtm_workspace_id         text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, business_id)
);

-- --- audits -----------------------------------------------------------------
create table if not exists public.audits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete cascade,
  business_id        uuid references public.businesses (id) on delete set null,
  website_url        text not null,
  audit_mode         text not null,  -- url_only | connected
  date_start         date,
  date_end           date,
  status             text not null default 'pending',
  overall_score      int,
  paid_search_score  int,
  landing_page_score int,
  tracking_score     int,
  keyword_score      int,
  budget_waste_score int,
  executive_summary  text,
  -- Full report JSON is the source of truth for the MVP; the snapshot tables
  -- below can be backfilled by a worker for analytics/querying.
  report_json        jsonb,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);
create index if not exists audits_user_idx on public.audits (user_id, created_at desc);

-- --- crawled_pages ----------------------------------------------------------
create table if not exists public.crawled_pages (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references public.audits (id) on delete cascade,
  url              text not null,
  title            text,
  meta_description text,
  h1               text,
  headings         jsonb,
  ctas             jsonb,
  forms            jsonb,
  phone_links      jsonb,
  internal_links   jsonb,
  detected_services jsonb,
  detected_locations jsonb,
  schema_json      jsonb,
  page_speed_score int,
  mobile_score     int,
  issues           jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists crawled_pages_audit_idx on public.crawled_pages (audit_id);

-- --- google_ads_snapshots ---------------------------------------------------
create table if not exists public.google_ads_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  audit_id            uuid not null references public.audits (id) on delete cascade,
  customer_id         text,
  campaign_id         text,
  campaign_name       text,
  ad_group_id         text,
  ad_group_name       text,
  keyword_text        text,
  search_term         text,
  landing_page_url    text,
  impressions         bigint,
  clicks              bigint,
  ctr                 numeric,
  cost_micros         bigint,
  conversions         numeric,
  conversion_rate     numeric,
  cost_per_conversion numeric,
  quality_score       int,
  date_range          jsonb,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists google_ads_snapshots_audit_idx on public.google_ads_snapshots (audit_id);

-- --- ga4_snapshots ----------------------------------------------------------
create table if not exists public.ga4_snapshots (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references public.audits (id) on delete cascade,
  property_id      text,
  page_path        text,
  landing_page     text,
  source           text,
  medium           text,
  campaign         text,
  sessions         bigint,
  users            bigint,
  engaged_sessions bigint,
  conversions      numeric,
  event_count      bigint,
  key_events       numeric,
  revenue          numeric,
  raw              jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists ga4_snapshots_audit_idx on public.ga4_snapshots (audit_id);

-- --- search_console_snapshots ----------------------------------------------
create table if not exists public.search_console_snapshots (
  id          uuid primary key default gen_random_uuid(),
  audit_id    uuid not null references public.audits (id) on delete cascade,
  site_url    text,
  query       text,
  page        text,
  country     text,
  device      text,
  clicks      bigint,
  impressions bigint,
  ctr         numeric,
  position    numeric,
  raw         jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists search_console_snapshots_audit_idx on public.search_console_snapshots (audit_id);

-- --- gtm_snapshots ----------------------------------------------------------
create table if not exists public.gtm_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  audit_id                  uuid not null references public.audits (id) on delete cascade,
  account_id                text,
  container_id              text,
  workspace_id              text,
  tags                      jsonb,
  triggers                  jsonb,
  variables                 jsonb,
  built_in_variables        jsonb,
  detected_tracking_issues  jsonb,
  raw                       jsonb,
  created_at                timestamptz not null default now()
);
create index if not exists gtm_snapshots_audit_idx on public.gtm_snapshots (audit_id);

-- --- recommendations --------------------------------------------------------
create table if not exists public.recommendations (
  id                  uuid primary key default gen_random_uuid(),
  audit_id            uuid not null references public.audits (id) on delete cascade,
  title               text not null,
  category            text,
  severity            text,
  evidence            jsonb,
  why_it_matters      text,
  recommended_fix     text,
  estimated_impact    text,
  difficulty          text,
  priority_score      int,
  related_entity_type text,
  related_entity_id   text,
  created_at          timestamptz not null default now()
);
create index if not exists recommendations_audit_idx on public.recommendations (audit_id);

-- --- ab_tests ---------------------------------------------------------------
create table if not exists public.ab_tests (
  id                uuid primary key default gen_random_uuid(),
  audit_id          uuid not null references public.audits (id) on delete cascade,
  test_name         text not null,
  hypothesis        text,
  test_type         text,
  control           text,
  variant           text,
  primary_metric    text,
  secondary_metric  text,
  success_criteria  text,
  minimum_runtime   text,
  recommended_tool  text,
  created_at        timestamptz not null default now()
);
create index if not exists ab_tests_audit_idx on public.ab_tests (audit_id);
