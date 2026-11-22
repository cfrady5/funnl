import 'server-only';
import { DatabaseNotConfiguredError, getDb, migrate, type Db } from '@tiresias/data';

let migrated: Promise<unknown> | null = null;

/** Run a read against Postgres (Supabase in production). Returns null when no database is configured. */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  try {
    const db = getDb();
    migrated ??= migrate(db).catch((e) => {
      migrated = null;
      throw e;
    });
    await migrated;
    return { ok: true, data: await fn(db) };
  } catch (e) {
    if (e instanceof DatabaseNotConfiguredError) return { ok: false, reason: e.message };
    return { ok: false, reason: `Database error: ${(e as Error).message}` };
  }
}
