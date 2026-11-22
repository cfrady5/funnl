-- Row-level security. Roles live in public.app_users (admin > editor > viewer).
-- Workers use the service role key, which bypasses RLS by design.

do $$
declare t text;
begin
  foreach t in array array['app_users', 'brands', 'teams', 'players', 'games', 'player_game_stats', 'play_events', 'media_rights',
    'video_sources', 'candidate_clips', 'clip_analysis', 'passing_options', 'video_projects', 'video_scenes', 'rendered_videos',
    'cover_assets', 'content_captions', 'publishing_accounts', 'publishing_jobs', 'platform_posts', 'engagement_metrics',
    'workflow_runs', 'workflow_steps', 'jobs', 'job_errors', 'ai_usage', 'audit_logs', 'app_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Read access for every signed-in team member on operational tables.
do $$
declare t text;
begin
  foreach t in array array['brands', 'teams', 'players', 'games', 'player_game_stats', 'play_events', 'media_rights', 'video_sources',
    'candidate_clips', 'clip_analysis', 'passing_options', 'video_projects', 'video_scenes', 'rendered_videos', 'cover_assets',
    'content_captions', 'publishing_jobs', 'platform_posts', 'engagement_metrics', 'workflow_runs', 'workflow_steps', 'jobs',
    'job_errors', 'ai_usage', 'app_settings']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.has_role(''viewer''))', t || '_read', t);
  end loop;
end $$;

-- Editors produce content.
do $$
declare t text;
begin
  foreach t in array array['media_rights', 'video_sources', 'candidate_clips', 'passing_options', 'video_projects', 'video_scenes', 'content_captions']
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(''editor''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t || '_update', t);
  end loop;
end $$;

-- Editors may enqueue jobs and request cancellation; workers (service role) run them.
create policy jobs_insert on public.jobs for insert to authenticated with check (public.has_role('editor') and status = 'queued');
create policy jobs_update on public.jobs for update to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));

-- Only admins delete content, change settings, manage users, or see publishing accounts.
create policy video_projects_delete on public.video_projects for delete to authenticated using (public.has_role('admin') and status not in ('scheduled', 'published'));
create policy app_settings_update on public.app_settings for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy app_users_self_read on public.app_users for select to authenticated using (user_id = auth.uid() or public.has_role('admin'));
create policy app_users_admin_write on public.app_users for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy publishing_accounts_admin on public.publishing_accounts for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy publishing_jobs_editor on public.publishing_jobs for insert to authenticated with check (public.has_role('editor'));
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.has_role('admin'));

-- Defence in depth: even admins reading through the API never see the vault reference.
-- (A column-level REVOKE is ineffective while a table-level grant exists, so
-- revoke the table and re-grant only the safe columns.)
revoke all on public.publishing_accounts from anon, authenticated;
grant select (id, platform, brand, account_handle, external_account_id, scopes, audit_status, token_expires_at, connected, last_verified_at, created_at, updated_at)
  on public.publishing_accounts to authenticated;
grant insert (platform, brand, account_handle, external_account_id, scopes) on public.publishing_accounts to authenticated;
grant update (account_handle, scopes, connected) on public.publishing_accounts to authenticated;
grant delete on public.publishing_accounts to authenticated;

-- Approval is a privileged transition: editors may not set approved_by to someone else.
create or replace function public.guard_project_approval() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    if auth.uid() is not null and new.approved_by is distinct from auth.uid() then
      raise exception 'approved_by must be the approving user';
    end if;
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end $$;
create trigger video_projects_approval before update on public.video_projects for each row execute function public.guard_project_approval();
