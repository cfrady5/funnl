import type { BrandId, CoverSpec, MediaRights, VideoSpec } from '@tiresias/core';

export const CONTENT_STATUSES = [
  'discovered',
  'awaiting_footage',
  'analyzing',
  'needs_review',
  'ready_to_render',
  'rendering',
  'ready_for_approval',
  'approved',
  'scheduled',
  'published',
  'failed',
  'rejected',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface MediaProbe {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string | null;
  audioCodec: string | null;
  /** Hard camera cuts detected in the normalised file (seconds). */
  cuts: number[];
}

export interface MediaRecord {
  id: string;
  /** Storage key of the normalised, editable file (H.264 CFR 30 fps, short GOP). */
  key: string | null;
  /** Storage key of the original upload, kept for provenance. */
  originalKey: string;
  kind: 'video' | 'image' | 'audio';
  originalName: string;
  bytes: number;
  sha256: string;
  status: 'processing' | 'ready' | 'failed';
  error: string | null;
  probe: MediaProbe | null;
  posterKey: string | null;
  rights: MediaRights;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  brand: BrandId;
  title: string;
  status: ContentStatus;
  mediaId: string;
  /** Spec with media keys (not URLs). */
  spec: VideoSpec;
  cover: Partial<Pick<CoverSpec, 'headline' | 'seriesTitle' | 'statLabel' | 'statValue' | 'teamName' | 'kicker' | 'statLine' | 'statSub' | 'blockColor'>> & { headshotMediaId?: string | null };
  /** Verified stat shown on the cover; null when not verified. */
  notes: string | null;
  latestRenderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenderRecord {
  id: string;
  projectId: string;
  status: 'queued' | 'rendering' | 'succeeded' | 'failed' | 'cancelled';
  progress: number;
  videoKey: string | null;
  coverKey: string | null;
  contactSheetKey: string | null;
  specKey: string | null;
  specHash: string | null;
  qa: unknown;
  qaPassed: boolean | null;
  renderMs: number | null;
  bytes: number | null;
  estimatedCostUsd: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export type JobType = 'ingest_media' | 'render_project' | 'daily_ingest';

export interface JobRecord {
  id: string;
  type: JobType;
  payload: Record<string, string>;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  progress: number;
  runAfter: string;
  cancelRequested: boolean;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface LogRecord {
  id: string;
  at: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SettingsRecord {
  timezone: string;
  dailyRunTime: string;
  tiresiasPerDay: number;
  antiTiresiasPerDay: number;
  selectionMode: 'one_per_player' | 'best_from_pool';
  automationLevel: 'manual' | 'approval_required' | 'automatic';
  minQualityScore: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  workerCostPerHourUsd: number;
  maxJobAttempts: number;
  enabledBrands: BrandId[];
}

export const DEFAULT_SETTINGS: SettingsRecord = {
  timezone: 'America/New_York',
  dailyRunTime: '08:00',
  tiresiasPerDay: 5,
  antiTiresiasPerDay: 3,
  selectionMode: 'one_per_player',
  automationLevel: 'approval_required',
  minQualityScore: 60,
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  workerCostPerHourUsd: 0.1,
  maxJobAttempts: 3,
  enabledBrands: ['tiresias', 'antitiresias'],
};

export interface DbShape {
  media: MediaRecord[];
  projects: ProjectRecord[];
  renders: RenderRecord[];
  jobs: JobRecord[];
  logs: LogRecord[];
  settings: SettingsRecord;
}
