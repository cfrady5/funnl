import { seedDemoProjects } from '@tiresias/render-worker/store';
import { SAMPLE_SPEC_ANTI, SAMPLE_SPEC_TIRESIAS } from '@tiresias/video/samples';
import { handle, ok } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Registers the synthetic (owned) fixtures and creates one demo project per brand. */
export const POST = handle(async () => ok(await seedDemoProjects([SAMPLE_SPEC_TIRESIAS, SAMPLE_SPEC_ANTI]), { status: 201 }));
