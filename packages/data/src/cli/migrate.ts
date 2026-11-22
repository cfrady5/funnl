/** Apply migrations + seed to DATABASE_URL (Supabase or local). */
import { getDb } from '../db';
import { migrate } from '../migrate';

const db = getDb();
const r = await migrate(db);
console.log(`applied: ${r.applied.join(', ') || 'none'}\nalready applied: ${r.skipped.length}${r.usedLocalAuthStub ? '\n(no auth schema found — local auth stub created; this never happens on Supabase)' : ''}`);
await db.end();
