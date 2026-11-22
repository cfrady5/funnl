import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Applies the real Supabase migrations + seed to an embedded Postgres (PGlite)
 * with a minimal stand-in for Supabase's `auth` schema and API roles, then
 * checks constraints, idempotency, the job-claim function and RLS behaviour.
 */
const ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase grants table privileges to API roles by default; RLS does the filtering.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const EDITOR = '00000000-0000-0000-0000-0000000000e1';
const VIEWER = '00000000-0000-0000-0000-0000000000f1';

let db: PGlite;

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}; set request.jwt.claim.sub = '${user ?? ''}';`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; set request.jwt.claim.sub = '';`);
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  await db.exec(readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8'));
  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${EDITOR}'), ('${VIEWER}');
    insert into public.app_users (user_id, role) values ('${ADMIN}', 'admin'), ('${EDITOR}', 'editor'), ('${VIEWER}', 'viewer');
  `);
});

async function makeProject(contentId: string) {
  const r = await db.query<{ id: string }>(`
    with r as (insert into public.media_rights (status, source_provider, rights_holder) values ('owned', 'generated', 'Tiresias') returning id),
         v as (insert into public.video_sources (kind, original_path, original_name, bytes, sha256, rights_id)
               select 'video', 'uploads/' || $1 || '.mp4', $1 || '.mp4', 100, encode(sha256(convert_to($1, 'UTF8')), 'hex'), id from r returning id)
    insert into public.video_projects (brand, content_id, title, video_source_id, spec)
    select 'tiresias', $1, 'test', id, '{}'::jsonb from v returning id`, [contentId]);
  return r.rows[0].id;
}

describe('supabase migrations', () => {
  it('apply cleanly and seed both brands', async () => {
    const r = await db.query<{ id: string }>('select id from public.brands order by id');
    expect(r.rows.map((x) => x.id)).toEqual(['tiresias', 'antitiresias']);
    const tables = await db.query<{ n: number }>(`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
    expect(tables.rows[0].n).toBeGreaterThanOrEqual(27);
  });

  it('rejects duplicate assets and invalid values', async () => {
    await makeProject('TRS-T-01');
    await expect(makeProject('TRS-T-01')).rejects.toThrow(); // duplicate sha256 / content id
    await expect(db.query(`insert into public.media_rights (status, source_provider, allowed_uses) values ('owned', 'x', array['resell'])`)).rejects.toThrow();
    await expect(db.query(`insert into public.teams (provider, provider_team_id, abbreviation, name) values ('p', '1', 'TOOLONG', 'x')`)).rejects.toThrow();
  });

  it('enforces workflow idempotency keys', async () => {
    await db.query(`insert into public.workflow_runs (workflow, brand, game_date, idempotency_key, trigger) values ('daily', 'tiresias', '2026-11-21', 'daily:tiresias:2026-11-21', 'schedule')`);
    await expect(
      db.query(`insert into public.workflow_runs (workflow, brand, game_date, idempotency_key, trigger) values ('daily', 'tiresias', '2026-11-21', 'daily:tiresias:2026-11-21', 'manual')`),
    ).rejects.toThrow(/duplicate key/);
  });

  it('allows only one actual passing option per project', async () => {
    const pid = await makeProject('TRS-T-02');
    await db.query(`insert into public.passing_options (project_id, label, description, x, y, frame_index, origin, confidence, is_actual) values ($1, 'A', 'Corner', 0.5, 0.5, 117, 'manual', 1, true)`, [pid]);
    await expect(
      db.query(`insert into public.passing_options (project_id, label, description, x, y, frame_index, origin, confidence, is_actual) values ($1, 'B', 'Roll', 0.4, 0.5, 117, 'manual', 1, true)`, [pid]),
    ).rejects.toThrow();
  });

  it('claims jobs atomically and honours idempotency for active jobs', async () => {
    await db.query(`insert into public.jobs (type, payload, idempotency_key) values ('render_project', '{"projectId":"x"}', 'render:x:1')`);
    await expect(db.query(`insert into public.jobs (type, idempotency_key) values ('render_project', 'render:x:1')`)).rejects.toThrow();
    const c1 = await db.query<{ id: string | null; status: string; attempts: number }>(`select * from public.claim_next_job('w1')`);
    expect(c1.rows[0].status).toBe('running');
    expect(c1.rows[0].attempts).toBe(1);
    const c2 = await db.query<{ id: string | null }>(`select * from public.claim_next_job('w2')`);
    expect(c2.rows[0].id).toBeNull();
    // once the job has failed, the same key may be used again (a deliberate rerun)
    await db.query(`update public.jobs set status = 'failed' where idempotency_key = 'render:x:1'`);
    await db.query(`insert into public.jobs (type, idempotency_key) values ('render_project', 'render:x:1')`);
  });

  it('prevents duplicate live publication of a project to one account', async () => {
    const pid = await makeProject('TRS-T-03');
    const acc = await db.query<{ id: string }>(`insert into public.publishing_accounts (platform, brand, account_handle) values ('tiktok', 'tiresias', '@tiresias') returning id`);
    const rv = await db.query<{ id: string }>(`insert into public.rendered_videos (project_id, status) values ($1, 'succeeded') returning id`, [pid]);
    const pj = await db.query<{ id: string }>(
      `insert into public.publishing_jobs (project_id, rendered_video_id, account_id, mode, idempotency_key) values ($1, $2, $3, 'approval_required', 'pub:1') returning id`,
      [pid, rv.rows[0].id, acc.rows[0].id],
    );
    const post = (state: string, ext: string) =>
      db.query(`insert into public.platform_posts (publishing_job_id, project_id, account_id, platform, external_post_id, state) values ($1, $2, $3, 'tiktok', $4, $5)`, [
        pj.rows[0].id, pid, acc.rows[0].id, ext, state,
      ]);
    await post('published', 'ext-1');
    await expect(post('processing', 'ext-2')).rejects.toThrow();
    await post('failed', 'ext-3'); // failed attempts do not block
  });
});

describe('row-level security', () => {
  it('blocks anonymous access entirely', async () => {
    const r = await as(null, () => db.query('select * from public.video_projects'));
    expect(r.rows).toHaveLength(0);
  });

  it('lets viewers read but not write', async () => {
    const rows = await as(VIEWER, () => db.query('select content_id from public.video_projects'));
    expect(rows.rows.length).toBeGreaterThan(0);
    const upd = await as(VIEWER, () => db.query(`update public.video_projects set title = 'hacked' returning id`));
    expect(upd.rows).toHaveLength(0);
  });

  it('lets editors edit projects but not delete them or touch settings', async () => {
    const upd = await as(EDITOR, () => db.query(`update public.video_projects set title = 'edited' where content_id = 'TRS-T-01' returning id`));
    expect(upd.rows).toHaveLength(1);
    const del = await as(EDITOR, () => db.query(`delete from public.video_projects where content_id = 'TRS-T-01' returning id`));
    expect(del.rows).toHaveLength(0);
    const s = await as(EDITOR, () => db.query(`update public.app_settings set daily_budget_usd = 999 returning id`));
    expect(s.rows).toHaveLength(0);
  });

  it('records the approving user and rejects spoofed approvers', async () => {
    await expect(
      as(EDITOR, () => db.query(`update public.video_projects set status = 'approved', approved_by = '${ADMIN}' where content_id = 'TRS-T-01'`)),
    ).rejects.toThrow(/approving user/);
    const ok = await as(EDITOR, () => db.query<{ approved_at: string }>(`update public.video_projects set status = 'approved', approved_by = '${EDITOR}' where content_id = 'TRS-T-01' returning approved_at`));
    expect(ok.rows[0].approved_at).toBeTruthy();
  });

  it('hides publishing accounts from non-admins and the vault reference from everyone', async () => {
    const viewer = await as(VIEWER, () => db.query('select id, account_handle from public.publishing_accounts'));
    expect(viewer.rows).toHaveLength(0);
    const admin = await as(ADMIN, () => db.query('select id, account_handle from public.publishing_accounts'));
    expect(admin.rows.length).toBeGreaterThan(0);
    await expect(as(ADMIN, () => db.query('select credential_secret_id from public.publishing_accounts'))).rejects.toThrow(/permission denied/);
  });

  it('keeps the audit log admin-only', async () => {
    await db.query(`insert into public.audit_logs (scope, action) values ('test', 'x')`);
    expect((await as(EDITOR, () => db.query('select * from public.audit_logs'))).rows).toHaveLength(0);
    expect((await as(ADMIN, () => db.query('select * from public.audit_logs'))).rows.length).toBeGreaterThan(0);
  });
});
