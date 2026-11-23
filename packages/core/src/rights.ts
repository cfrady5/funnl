import { z } from 'zod';

/**
 * Media rights are tracked separately from discovery and acquisition. A clip
 * can be *discovered* (we know it exists), *acquired* (we have the bytes) and
 * still be *unpublishable* (no redistribution right). Publication is blocked
 * unless rights are explicit, current and cover the intended use.
 */
export const RIGHTS_STATUSES = [
  'owned', // we created it (e.g. synthetic fixtures, our own filming)
  'licensed', // covered by a written licence agreement
  'permission_granted', // documented one-off permission from the rights holder
  'public_domain',
  'unknown', // default — blocks publication
  'restricted', // known NOT to allow our use
  'expired',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const USAGE_TYPES = ['internal_preview', 'social_publication', 'commercial'] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

export const MediaRightsSchema = z.object({
  status: z.enum(RIGHTS_STATUSES).default('unknown'),
  sourceProvider: z.string().min(1).default('manual_upload'),
  sourceUrl: z.string().nullable().default(null),
  sourceIdentifier: z.string().nullable().default(null),
  rightsHolder: z.string().nullable().default(null),
  licenseReference: z.string().nullable().default(null),
  allowedUses: z.array(z.enum(USAGE_TYPES)).default(['internal_preview']),
  redistributionPermitted: z.boolean().default(false),
  attributionRequired: z.boolean().default(false),
  attributionText: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null), // ISO timestamp
  verifiedBy: z.string().nullable().default(null),
  verifiedAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type MediaRights = z.infer<typeof MediaRightsSchema>;

export interface RightsDecision {
  ok: boolean;
  reasons: string[];
}

const CLEARED: RightsStatus[] = ['owned', 'licensed', 'permission_granted', 'public_domain'];

/** Can this asset be used for the given purpose right now? Defaults to "no". */
export function checkRights(
  rights: MediaRights | null | undefined,
  use: UsageType,
  now: Date = new Date(),
): RightsDecision {
  const reasons: string[] = [];
  if (!rights) return { ok: false, reasons: ['No rights record exists for this asset.'] };
  // Internal previews (never published) are allowed unless rights are known to be refused or expired.
  if (use === 'internal_preview') {
    if (rights.status === 'restricted') reasons.push('Rights status is "restricted".');
    if (rights.status === 'expired' || (rights.expiresAt && new Date(rights.expiresAt).getTime() <= now.getTime())) reasons.push('Rights have expired.');
    return { ok: reasons.length === 0, reasons };
  }
  if (!CLEARED.includes(rights.status)) {
    reasons.push(`Rights status is "${rights.status}".`);
  }
  if (rights.expiresAt && new Date(rights.expiresAt).getTime() <= now.getTime()) {
    reasons.push(`Rights expired at ${rights.expiresAt}.`);
  }
  if (!rights.allowedUses.includes(use)) {
    reasons.push(`Allowed uses (${rights.allowedUses.join(', ') || 'none'}) do not include "${use}".`);
  }
  {
    // Publication / commercial use (internal_preview returned above).
    if (!rights.redistributionPermitted) reasons.push('Public redistribution is not permitted.');
    if (!rights.rightsHolder) reasons.push('Rights holder is not recorded.');
    if (rights.status !== 'owned' && rights.status !== 'public_domain' && !rights.licenseReference) {
      reasons.push('No licence or permission reference is recorded.');
    }
    if (rights.attributionRequired && !rights.attributionText) {
      reasons.push('Attribution is required but no attribution text is recorded.');
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/** Rights for assets this system generates itself (synthetic fixtures, graphics). */
export function ownedRights(holder: string, notes: string): MediaRights {
  return MediaRightsSchema.parse({
    status: 'owned',
    sourceProvider: 'generated',
    rightsHolder: holder,
    allowedUses: ['internal_preview', 'social_publication', 'commercial'],
    redistributionPermitted: true,
    notes,
  });
}
