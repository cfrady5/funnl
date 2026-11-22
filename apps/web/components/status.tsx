import type { MediaRights } from '@tiresias/core';
import { Badge } from './ui';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'anti';

const CONTENT_TONES: Record<string, Tone> = {
  discovered: 'neutral',
  awaiting_footage: 'neutral',
  analyzing: 'info',
  needs_review: 'warn',
  ready_to_render: 'info',
  rendering: 'info',
  ready_for_approval: 'good',
  approved: 'good',
  scheduled: 'info',
  published: 'good',
  failed: 'bad',
  rejected: 'bad',
};

export function ContentStatusBadge({ status }: { status: string }) {
  return <Badge tone={CONTENT_TONES[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}

const JOB_TONES: Record<string, Tone> = { queued: 'neutral', running: 'info', succeeded: 'good', failed: 'bad', cancelled: 'warn', processing: 'info', ready: 'good', rendering: 'info' };
export function JobStatusBadge({ status }: { status: string }) {
  return <Badge tone={JOB_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

export function RightsBadge({ rights }: { rights: MediaRights }) {
  const tone: Tone = ['owned', 'licensed', 'permission_granted', 'public_domain'].includes(rights.status) ? 'good' : rights.status === 'unknown' ? 'warn' : 'bad';
  return <Badge tone={tone}>rights: {rights.status.replace(/_/g, ' ')}</Badge>;
}

export function BrandBadge({ brand }: { brand: string }) {
  return brand === 'tiresias' ? <Badge tone="good">Tiresias</Badge> : <Badge tone="anti">AntiTiresias</Badge>;
}
