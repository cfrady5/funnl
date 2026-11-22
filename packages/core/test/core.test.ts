import { describe, expect, it } from 'vitest';
import {
  autoFraming,
  checkRights,
  computeTimeline,
  createDefaultSpec,
  MediaRightsSchema,
  nextDailyRun,
  layoutOptions,
  previousGameDate,
  projectPoint,
  rankAssistLeaders,
  resolveFraming,
  scoreCandidate,
  selectClips,
  sourceTimeAt,
  validateSpec,
  zonedTimeToUtc,
  type VideoSpec,
} from '../src';

const SRC = { src: 'x.mp4', width: 1920, height: 1080, fps: 30, durationSec: 10 };
const spec = (over: Partial<VideoSpec> = {}): VideoSpec => ({ ...createDefaultSpec('tiresias', SRC, 'TRS-TEST-01'), freezeSec: 4, ...over });

describe('timeline', () => {
  it('produces a 22 s composition with contiguous scenes', () => {
    const tl = computeTimeline(spec());
    expect(tl.durationInFrames).toBe(660);
    let cursor = 0;
    for (const s of tl.scenes) {
      expect(s.from).toBe(cursor);
      cursor += s.durationInFrames;
    }
  });

  it('covers every frame with exactly one source segment', () => {
    const tl = computeTimeline(spec());
    for (let f = 0; f < tl.durationInFrames; f++) {
      const hits = tl.segments.filter((s) => f >= s.from && f < s.from + s.durationInFrames);
      expect(hits.length, `frame ${f}`).toBe(1);
    }
  });

  it('arrives exactly at the freeze frame and holds through decision + countdown', () => {
    const s = spec();
    const tl = computeTimeline(s);
    const decision = tl.scenes.find((x) => x.id === 'decision')!;
    expect(sourceTimeAt(tl, decision.from - 1)).toBeCloseTo(4 - 1 / 30, 2);
    expect(sourceTimeAt(tl, decision.from)).toBe(4);
    expect(sourceTimeAt(tl, decision.from + 200)).toBe(4);
  });

  it('slows the hook down and holds when lead-in is short', () => {
    const tl = computeTimeline(spec({ freezeSec: 1 }));
    const hook = tl.segments.filter((x) => x.from < 90);
    expect(hook[0].kind).toBe('hold');
    expect(hook[1].playbackRate).toBe(0.5);
    expect(sourceTimeAt(tl, 0)).toBeGreaterThanOrEqual(0);
  });

  it('never plays past the clip end', () => {
    const s = spec({ clip: { startSec: 0, endSec: 5 }, freezeSec: 4 });
    const tl = computeTimeline(s);
    for (let f = 0; f < tl.durationInFrames; f++) expect(sourceTimeAt(tl, f)).toBeLessThanOrEqual(5);
  });
});

describe('layout', () => {
  it('centres focus and clamps to source edges', () => {
    const fr = resolveFraming(SRC, { zoom: 2, focusX: 0, focusY: 0.5 });
    expect(fr.offsetX).toBe(0);
    const p = projectPoint(SRC, fr, { x: 0, y: 0.5 });
    expect(p.x).toBe(0);
  });

  it('auto framing keeps every option inside the panel', () => {
    const s = spec();
    const kf = autoFraming(SRC, [s.handler!, ...s.options], { t: s.freezeSec });
    const fr = resolveFraming(SRC, kf);
    for (const o of s.options) expect(projectPoint(SRC, fr, o).insidePanel).toBe(true);
  });

  it('separates colliding chips', () => {
    const s = spec();
    s.options = [
      { ...s.options[0], x: 0.5, y: 0.5 },
      { ...s.options[1], x: 0.51, y: 0.5 },
    ];
    const { items, problems } = layoutOptions(s);
    expect(problems).toEqual([]);
    expect(Math.abs(items[0].chip.x - items[1].chip.x)).toBeGreaterThanOrEqual(92);
  });
});

describe('validation', () => {
  it('accepts the default spec', () => {
    expect(validateSpec(spec()).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('rejects freeze outside clip and actual not in options', () => {
    const s = spec({ freezeSec: 9.9, clip: { startSec: 0, endSec: 8 } });
    s.assessment = { ...s.assessment, actual: 'D' };
    const codes = validateSpec(s).map((i) => i.code);
    expect(codes).toContain('freeze.range');
    expect(codes).toContain('assessment.actual');
  });
  it('flags off-panel options under manual framing', () => {
    const s = spec({ framing: { mode: 'manual', keyframes: [{ t: 0, zoom: 3, focusX: 0.5, focusY: 0.5 }] } });
    s.options[0] = { ...s.options[0], x: 0.02 };
    expect(validateSpec(s).map((i) => i.code)).toContain('layout.options');
  });
});

describe('rights gate', () => {
  it('blocks unknown rights by default', () => {
    const r = checkRights(MediaRightsSchema.parse({}), 'social_publication');
    expect(r.ok).toBe(false);
  });
  it('allows fully documented licences and blocks expired ones', () => {
    const base = MediaRightsSchema.parse({
      status: 'licensed',
      rightsHolder: 'Example Rights Co',
      licenseReference: 'LIC-42',
      allowedUses: ['internal_preview', 'social_publication'],
      redistributionPermitted: true,
    });
    expect(checkRights(base, 'social_publication').ok).toBe(true);
    expect(checkRights({ ...base, expiresAt: '2020-01-01T00:00:00Z' }, 'social_publication').ok).toBe(false);
    expect(checkRights({ ...base, attributionRequired: true }, 'social_publication').ok).toBe(false);
  });
  it('internal preview does not need redistribution rights', () => {
    const r = MediaRightsSchema.parse({ status: 'permission_granted', allowedUses: ['internal_preview'] });
    expect(checkRights(r, 'internal_preview').ok).toBe(true);
  });
});

describe('dates (America/New_York)', () => {
  it('uses the New York calendar date, not UTC', () => {
    // 03:30 UTC on Nov 23 is 22:30 Nov 22 in New York.
    expect(previousGameDate(new Date('2026-11-23T03:30:00Z'))).toBe('2026-11-21');
    expect(previousGameDate(new Date('2026-11-23T13:00:00Z'))).toBe('2026-11-22');
  });
  it('maps 08:00 New York to the correct UTC instant across DST', () => {
    expect(zonedTimeToUtc('2026-01-15', '08:00').toISOString()).toBe('2026-01-15T13:00:00.000Z'); // EST
    expect(zonedTimeToUtc('2026-07-15', '08:00').toISOString()).toBe('2026-07-15T12:00:00.000Z'); // EDT
    expect(zonedTimeToUtc('2026-03-08', '08:00').toISOString()).toBe('2026-03-08T12:00:00.000Z'); // spring-forward day
    expect(zonedTimeToUtc('2026-11-01', '08:00').toISOString()).toBe('2026-11-01T13:00:00.000Z'); // fall-back day
  });
  it('handles the spring-forward gap and the fall-back overlap', () => {
    expect(zonedTimeToUtc('2026-03-08', '02:30').toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(zonedTimeToUtc('2026-11-01', '01:30').toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
  it('schedules the next run correctly', () => {
    expect(nextDailyRun(new Date('2026-03-07T14:00:00Z')).toISOString()).toBe('2026-03-08T12:00:00.000Z');
    expect(nextDailyRun(new Date('2026-11-22T12:59:00Z')).toISOString()).toBe('2026-11-22T13:00:00.000Z');
  });
});

describe('scoring and selection', () => {
  it('reports a transparent breakdown and coverage', () => {
    const s = scoreCandidate({ passingOptions: { value: 1, source: 'cv' }, cameraAngle: { value: 0.5, source: 'reviewer' } });
    expect(s.factors).toHaveLength(10);
    expect(s.total).toBeCloseTo(14 + 5, 0);
    expect(s.coverage).toBeCloseTo(0.24, 2);
  });
  const lines = [
    { playerId: 'p1', name: 'A', teamAbbr: 'DEN', gameId: 'g1', assists: 13, turnovers: 2, minutes: 36 },
    { playerId: 'p2', name: 'B', teamAbbr: 'BOS', gameId: 'g2', assists: 13, turnovers: 4, minutes: 34 },
    { playerId: 'p3', name: 'C', teamAbbr: 'LAL', gameId: 'g3', assists: 11, turnovers: 1, minutes: 30 },
    { playerId: 'p4', name: 'D', teamAbbr: 'NYK', gameId: 'g4', assists: 9, turnovers: 1, minutes: 30 },
  ];
  it('ranks with deterministic tie-breaks', () => {
    expect(rankAssistLeaders(lines).map((l) => l.playerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
  it('returns fewer clips rather than substituting ineligible ones', () => {
    const clips = [
      { clipId: 'c1', playerId: 'p1', score: 80, eligible: true },
      { clipId: 'c2', playerId: 'p2', score: 90, eligible: false },
      { clipId: 'c3', playerId: 'p3', score: 70, eligible: true },
    ];
    expect(selectClips(lines, clips, 'one_per_player', 2).map((c) => c.clipId)).toEqual(['c1']);
    expect(selectClips(lines, clips, 'best_from_pool', 5).map((c) => c.clipId)).toEqual(['c1', 'c3']);
  });
});

describe('daily schedule slots', () => {
  it('nothing is due before 08:00 New York', async () => {
    const { dueScheduleSlots } = await import('../src');
    expect(dueScheduleSlots(new Date('2026-11-22T12:59:00Z')).slots).toEqual([]); // 07:59 EST
  });
  it('slots accumulate through the retry ladder (EST and EDT)', async () => {
    const { dueScheduleSlots } = await import('../src');
    expect(dueScheduleSlots(new Date('2026-11-22T13:00:00Z'))).toEqual({ gameDate: '2026-11-21', slots: ['08:00'] });
    expect(dueScheduleSlots(new Date('2026-11-22T16:05:00Z')).slots).toEqual(['08:00', '08:30', '09:30', '11:00']);
    expect(dueScheduleSlots(new Date('2026-07-10T12:31:00Z')).slots).toEqual(['08:00', '08:30']); // EDT
  });
});
