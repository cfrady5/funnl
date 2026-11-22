import { coverFromVideoSpec, getTheme } from '@tiresias/core';
import { createProject } from '@tiresias/render-worker/store';
import { z } from 'zod';
import { withDb } from '@/lib/data';
import { fail, handle, ok, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Turn a discovered candidate play into a Phase 1 video project. Requires an
 * authorised clip from the library (discovery providers never supply footage).
 * Player, team, stat line and cover stats come from the verified box score.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(await req.json());
  const r = await withDb(async (db) =>
    db.one<{ brand: 'tiresias' | 'antitiresias'; player: string; team: string; team_name: string; game_label: string; ast: number; pts: number; reb: number; tov: number; pm: number | null; description: string; verified: boolean | null; game_date: string; candidate_id: string }>(
      `select c.brand, p.full_name player, t.abbreviation team, t.full_name team_name, at.abbreviation || ' @ ' || ht.abbreviation game_label, s.assists ast, s.points pts, s.rebounds reb,
              s.turnovers tov, s.plus_minus pm, e.description, g.box_verified verified, c.game_date::text, c.id candidate_id
         from public.candidate_clips c join public.play_events e on e.id = c.play_event_id join public.players p on p.id = c.player_id
         join public.games g on g.id = c.game_id join public.player_game_stats s on s.game_id = g.id and s.player_id = p.id join public.teams t on t.id = s.team_id
         join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id where c.id = $1`,
      [id],
    ),
  );
  if (!r.ok) return fail(503, r.reason);
  const c = r.data;
  if (!c) return fail(404, 'Candidate not found');
  const project = await createProject(mediaId, c.brand);
  const anti = c.brand === 'antitiresias';
  const statLine = anti ? `${c.tov} TOV · ${c.pts} PTS` : `${c.ast} AST · ${c.pts} PTS`;
  const updated = await store().update((db) => {
    const p = db.projects.find((x) => x.id === project.id)!;
    p.spec = {
      ...p.spec,
      player: { name: c.player, teamAbbr: c.team, teamName: c.team_name, statLine, gameLabel: c.game_label },
      text: { ...p.spec.text, hook: anti ? `${c.player.split(' ').slice(-1)[0].toUpperCase()}. NO.` : `CAN YOU SEE THE PASS BEFORE ${c.player.split(' ').slice(-1)[0].toUpperCase()} DOES?`.slice(0, 64) },
    };
    const cover = coverFromVideoSpec(p.spec, anti ? c.tov : c.ast);
    p.cover = { statValue: anti ? c.tov : c.ast, statLabel: anti ? 'TURNOVERS LAST NIGHT' : 'ASSISTS LAST NIGHT', kicker: cover.kicker ?? undefined, statLine: `${c.pts}p/${c.reb}r/${c.ast}a`, statSub: c.pm == null ? null : `${c.pm > 0 ? '+' : ''}${c.pm}`, teamName: c.team_name, seriesTitle: getTheme(c.brand).seriesTitle };
    p.title = `${p.spec.contentId} · ${c.player} · ${c.game_label}`;
    p.notes = `From candidate ${c.candidate_id} (${c.game_date}): ${c.description}.${c.verified ? '' : ' Box score NOT verified against final score — check stats before approval.'}`;
    return p;
  });
  await withDb((db) => db.query(`update public.candidate_clips set status = 'selected', project_ref = $2, video_source_id = null, updated_at = now() where id = $1`, [id, updated.id]));
  await store().log('info', 'discovery', `Created project ${updated.spec.contentId} from candidate`, { candidateId: id });
  return ok(updated, { status: 201 });
});
