import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

function wrap(client: pg.Pool | pg.PoolClient): Omit<Db, 'tx' | 'end'> {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await client.query(sql, params as unknown[]);
      return r.rows as T[];
    },
    async one<T>(sql: string, params: unknown[] = []) {
      const r = await client.query(sql, params as unknown[]);
      return (r.rows[0] as T) ?? null;
    },
  };
}

/**
 * Postgres access over a connection string. In production this is the
 * Supabase Postgres URL (Project Settings → Database); locally it is the
 * embedded server started by `npm run db:local`.
 */
export function createDb(connectionString: string, opts: { max?: number } = {}): Db {
  const pool = new pg.Pool({
    connectionString,
    max: opts.max ?? 5,
    // Supabase requires TLS; local loopback does not.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  const base = wrap(pool);
  return {
    ...base,
    async tx<T>(fn: (db: Db) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const inner = wrap(client);
        const result = await fn({ ...inner, tx: (f) => f({ ...inner, tx: () => Promise.reject(new Error('nested tx')), end: async () => undefined }), end: async () => undefined });
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}

export const LOCAL_DB_URL = 'postgres://postgres:postgres@127.0.0.1:54329/postgres';

let shared: Db | null = null;
/** Process-wide pool from DATABASE_URL. Throws a helpful error when unset. */
export function getDb(): Db {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new DatabaseNotConfiguredError();
    shared = createDb(url);
  }
  return shared;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL is not set. Use your Supabase Postgres connection string, or run `npm run db:local` and set DATABASE_URL=' + LOCAL_DB_URL);
    this.name = 'DatabaseNotConfiguredError';
  }
}
