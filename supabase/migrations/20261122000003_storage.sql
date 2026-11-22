-- Private storage buckets (Supabase Storage). Skipped automatically when the
-- storage schema is absent (e.g. plain Postgres used in CI).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values
      ('media', 'media', false),    -- uploads, normalised masters, posters
      ('renders', 'renders', false) -- MP4s, covers, contact sheets, spec snapshots
    on conflict (id) do nothing;

    execute $p$create policy "team reads media" on storage.objects for select to authenticated using (bucket_id in ('media', 'renders') and public.has_role('viewer'))$p$;
    execute $p$create policy "editors upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.has_role('editor'))$p$;
  end if;
end $$;
