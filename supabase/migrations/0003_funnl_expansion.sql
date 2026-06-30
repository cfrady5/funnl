-- ============================================================================
-- funnl — SEO + PPC expansion
-- ============================================================================
-- Apply AFTER 0001_init.sql and 0002_rls.sql.
--
-- Adds: expanded business profile fields, the full Search Funnel score set on
-- audits, urgency/confidence on recommendations, and the content_opportunities
-- table for the content strategy engine.
-- ============================================================================

-- --- businesses: new profile fields ----------------------------------------
alter table public.businesses
  add column if not exists service_area              text,
  add column if not exists monthly_marketing_budget  numeric,
  add column if not exists top_services              jsonb not null default '[]'::jsonb,
  add column if not exists competitors               jsonb not null default '[]'::jsonb,
  add column if not exists target_customer           text,
  add column if not exists marketing_status          text not null default 'unknown';

-- --- audits: full Search Funnel score set ----------------------------------
-- Older columns (overall_score, paid_search_score, ...) remain for back-compat;
-- the app now writes the funnl score set below.
alter table public.audits
  add column if not exists audit_type                    text,
  add column if not exists search_funnel_score           int,
  add column if not exists seo_foundation_score          int,
  add column if not exists technical_seo_score           int,
  add column if not exists content_quality_score         int,
  add column if not exists local_visibility_score        int,
  add column if not exists ai_search_readiness_score     int,
  add column if not exists ppc_efficiency_score          int,
  add column if not exists conversion_tracking_score     int,
  add column if not exists budget_waste_risk_score       int,
  add column if not exists measurement_confidence_score  int;

-- --- crawled_pages: richer SEO extraction ----------------------------------
alter table public.crawled_pages
  add column if not exists status_code        int,
  add column if not exists canonical_url      text,
  add column if not exists robots_meta        text,
  add column if not exists external_links     jsonb,
  add column if not exists images             jsonb,
  add column if not exists videos             jsonb,
  add column if not exists trust_signals      jsonb,
  add column if not exists conversion_issues  jsonb,
  add column if not exists body_summary       text;

-- --- recommendations: prioritization inputs --------------------------------
alter table public.recommendations
  add column if not exists urgency     text,
  add column if not exists confidence  text;

-- --- content_opportunities -------------------------------------------------
create table if not exists public.content_opportunities (
  id                              uuid primary key default gen_random_uuid(),
  audit_id                        uuid not null references public.audits (id) on delete cascade,
  page_type                       text,
  title                           text not null,
  slug                            text,
  search_intent                   text,
  query_cluster                   jsonb,
  user_problem                    text,
  business_goal                   text,
  required_sections               jsonb,
  suggested_cta                   text,
  internal_links                  jsonb,
  structured_data_recommendation  text,
  ppc_relevance                   text,
  priority_score                  int,
  created_at                      timestamptz not null default now()
);
create index if not exists content_opportunities_audit_idx on public.content_opportunities (audit_id);

-- --- RLS for content_opportunities (read scoped via parent audit) ----------
alter table public.content_opportunities enable row level security;
create policy "content_opportunities owner can read" on public.content_opportunities
  for select using (
    exists (select 1 from public.audits a where a.id = content_opportunities.audit_id and a.user_id = auth.uid())
  );
