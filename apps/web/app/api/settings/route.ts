import { BRAND_IDS } from '@tiresias/core';
import { z } from 'zod';
import { handle, ok, readDb, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SettingsPatch = z
  .object({
    dailyRunTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    tiresiasPerDay: z.number().int().min(0).max(10),
    antiTiresiasPerDay: z.number().int().min(0).max(10),
    selectionMode: z.enum(['one_per_player', 'best_from_pool']),
    automationLevel: z.enum(['manual', 'approval_required', 'automatic']),
    minQualityScore: z.number().min(0).max(100),
    dailyBudgetUsd: z.number().min(0).max(1000),
    monthlyBudgetUsd: z.number().min(0).max(10000),
    workerCostPerHourUsd: z.number().min(0).max(100),
    maxJobAttempts: z.number().int().min(1).max(10),
    enabledBrands: z.array(z.enum(BRAND_IDS)),
  })
  .partial();

export const GET = handle(async () => ok((await readDb()).settings));

export const PATCH = handle(async (req: Request) => {
  const patch = SettingsPatch.parse(await req.json());
  const s = await store().update((db) => {
    db.settings = { ...db.settings, ...patch };
    return db.settings;
  });
  await store().log('info', 'settings', 'Settings updated', { keys: Object.keys(patch) });
  return ok(s);
});
