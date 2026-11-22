import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Db } from './db';

export function repoRoot(): string {
  let dir = process.env.TIRESIAS_ROOT ? path.resolve(process.env.TIRESIAS_ROOT) : process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'supabase/migrations'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('Could not locate the repository root (supabase/migrations). Set TIRESIAS_ROOT.');
}

/**
 * Minimal stand-in for Supabase's `auth` schema and API roles, applied ONLY
 * when the target database has no `auth` schema (i.e. plain local Postgres).
 * Never applied to a Supabase project.
 */
export const LOCAL_AUTH_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  usedLocalAuthStub: boolean;
}

/** Apply supabase/migrations/*.sql in order, once each, tracked in tiresias_meta.migrations. */
export async function migrate(db: Db, opts: { seed?: boolean } = {}): Promise<MigrationResult> {
  const root = repoRoot();
  const dir = path.join(root, 'supabase/migrations');
  const hasAuth = await db.one<{ n: number }>(`select count(*)::int as n from information_schema.schemata where schema_name = 'auth'`);
  let usedLocalAuthStub = false;
  if (!hasAuth?.n) {
    await db.query(LOCAL_AUTH_STUB);
    usedLocalAuthStub = true;
  }
  await db.query(`create schema if not exists tiresias_meta; create table if not exists tiresias_meta.migrations (version text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query<{ version: string }>('select version from tiresias_meta.migrations')).map((r) => r.version));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), 'utf8');
    await db.tx(async (t) => {
      await t.query(sql);
      await t.query('insert into tiresias_meta.migrations (version) values ($1)', [file]);
    });
    applied.push(file);
  }
  if (opts.seed !== false) await db.query(readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8'));
  return { applied, skipped, usedLocalAuthStub };
}
