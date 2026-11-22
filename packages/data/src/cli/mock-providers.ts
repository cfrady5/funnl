/** Start the SIMULATED provider server for local development (fictional data). */
import { startMockProviders } from '../mock/server';

process.env.MOCK_PROVIDERS_PORT ??= '8787';
const m = await startMockProviders({ balldontlieTier: (process.env.MOCK_BDL_TIER as 'free' | 'allstar' | 'goat') ?? 'goat' });
console.log(`SIMULATED providers on ${m.base}. Export these to point the app at them:\n`);
for (const [k, v] of Object.entries(m.env)) console.log(`export ${k}=${v}`);
