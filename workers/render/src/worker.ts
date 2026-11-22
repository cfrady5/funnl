/**
 * Long-running worker: claims jobs from the store and executes them.
 *   npm run worker            # loop forever
 *   npm run worker -- --once  # drain the queue then exit (used by tests / cron)
 */
import { getBundle } from './render';
import { runOnce } from './jobs';
import { getStore } from './store';

const once = process.argv.includes('--once');
const store = getStore();
let stopping = false;
process.on('SIGINT', () => (stopping = true));
process.on('SIGTERM', () => (stopping = true));

const recovered = await store.recoverStale();
if (recovered) await store.log('warn', 'worker', `Re-queued ${recovered} job(s) left running by a previous worker`);
await store.log('info', 'worker', `Worker started (pid ${process.pid})`);
void getBundle().catch((e) => console.error('Bundle warm-up failed:', e.message));

while (!stopping) {
  const did = await runOnce(store);
  if (!did) {
    if (once) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await store.log('info', 'worker', 'Worker stopped');
process.exit(0);
