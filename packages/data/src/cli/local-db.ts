/**
 * Local Postgres-protocol server backed by embedded PGlite (persisted under
 * data/pglite). Lets the dashboard and worker share one database exactly as
 * they would share Supabase in production.
 *
 *   npm run db:local     # then: export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createDb, LOCAL_DB_URL } from '../db';
import { migrate, repoRoot } from '../migrate';

const dataDir = path.resolve(process.env.TIRESIAS_PGLITE_DIR ?? path.join(repoRoot(), 'data/pglite'));
mkdirSync(dataDir, { recursive: true });
const port = Number(process.env.TIRESIAS_PGLITE_PORT ?? 54329);
const db = await PGlite.create(dataDir);
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log(`Local Postgres (PGlite) on 127.0.0.1:${port}, data in ${dataDir}`);

const client = createDb(LOCAL_DB_URL.replace('54329', String(port)), { max: 1 });
const r = await migrate(client);
await client.end();
console.log(`Migrations: ${r.applied.length} applied, ${r.skipped.length} already present${r.usedLocalAuthStub ? ' (local auth stub in use)' : ''}`);
console.log(`DATABASE_URL=${LOCAL_DB_URL.replace('54329', String(port))}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
