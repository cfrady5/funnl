-- ============================================================================
-- SEM Command Center — Row Level Security (RLS)
-- ============================================================================
-- Apply AFTER 0001_init.sql.
--
-- Model:
--   * Every table is owner-scoped by user_id (= auth.uid()).
--   * Child tables (snapshots, recommendations, ab_tests, crawled_pages) are
--     scoped via their parent audit's user_id.
--   * The SERVICE ROLE key bypasses RLS entirely — it is used ONLY in trusted
--     server code (lib/store.ts via createAdminClient) to write audit results.
--     NEVER expose the service role key to the browser.
--
-- After enabling, the anon/auth client can only ever see the signed-in user's
-- own rows. This is the recommended baseline for a multi-tenant SaaS.
-- ============================================================================

alter table public.profiles                 enable row level security;
alter table public.businesses                enable row level security;
alter table public.google_integrations       enable row level security;
alter table public.selected_google_accounts  enable row level security;
alter table public.audits                    enable row level security;
alter table public.crawled_pages             enable row level security;
alter table public.google_ads_snapshots      enable row level security;
alter table public.ga4_snapshots             enable row level security;
alter table public.search_console_snapshots  enable row level security;
alter table public.gtm_snapshots             enable row level security;
alter table public.recommendations           enable row level security;
alter table public.ab_tests                  enable row level security;

-- --- profiles ---------------------------------------------------------------
create policy "profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles are self-updatable" on public.profiles
  for update using (auth.uid() = id);

-- --- owner-scoped tables (direct user_id) ----------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'businesses', 'google_integrations', 'selected_google_accounts', 'audits'
  ]
  loop
    execute format($f$
      create policy "%1$s owner can read" on public.%1$s
        for select using (auth.uid() = user_id);
      create policy "%1$s owner can insert" on public.%1$s
        for insert with check (auth.uid() = user_id);
      create policy "%1$s owner can update" on public.%1$s
        for update using (auth.uid() = user_id);
      create policy "%1$s owner can delete" on public.%1$s
        for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- --- audit-child tables (scoped via parent audit's user_id) -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'crawled_pages', 'google_ads_snapshots', 'ga4_snapshots',
    'search_console_snapshots', 'gtm_snapshots', 'recommendations', 'ab_tests'
  ]
  loop
    execute format($f$
      create policy "%1$s owner can read" on public.%1$s
        for select using (
          exists (
            select 1 from public.audits a
            where a.id = %1$s.audit_id and a.user_id = auth.uid()
          )
        );
    $f$, t);
    -- Writes to child tables happen via the service role (bypasses RLS), so we
    -- intentionally do not add insert/update policies for the anon/auth role.
  end loop;
end $$;
