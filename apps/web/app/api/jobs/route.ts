import { handle, ok, readDb } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok((await readDb()).jobs.slice(-200).reverse()));
