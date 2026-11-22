import { checkRights } from '@tiresias/core';
import { z } from 'zod';
import { handle, ok, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Editorial decisions. Approval is gated: a passing QA render must exist AND
 * the source footage must be cleared for social publication.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { action, reason } = z.object({ action: z.enum(['approve', 'reject', 'reopen']), reason: z.string().max(500).optional() }).parse(await req.json());
  const result = await store().update((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (!p) throw new Error('Project not found');
    if (action === 'approve') {
      const render = db.renders.find((r) => r.id === p.latestRenderId);
      const media = db.media.find((m) => m.id === p.mediaId);
      const blockers: string[] = [];
      if (!render || render.status !== 'succeeded') blockers.push('No successful render exists.');
      else if (!render.qaPassed) blockers.push('The latest render failed QA.');
      const rights = checkRights(media?.rights, 'social_publication');
      if (!rights.ok) blockers.push(...rights.reasons.map((r) => `Footage rights: ${r}`));
      if (blockers.length) return { ok: false as const, blockers };
      p.status = 'approved';
    } else if (action === 'reject') {
      p.status = 'rejected';
      p.notes = reason ?? p.notes;
    } else {
      p.status = 'needs_review';
    }
    p.updatedAt = new Date().toISOString();
    return { ok: true as const, project: p };
  });
  await store().log(result.ok ? 'info' : 'warn', 'editorial', result.ok ? `Project ${{ approve: 'approved', reject: 'rejected', reopen: 'reopened' }[action]}` : 'Approval blocked', { projectId: id, ...(result.ok ? {} : { blockers: result.blockers }) });
  return result.ok ? ok(result.project) : ok({ error: 'Approval blocked', blockers: result.blockers }, { status: 409 });
});
