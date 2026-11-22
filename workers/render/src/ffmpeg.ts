import { spawn } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(cmd: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    const timer = opts.timeoutMs ? setTimeout(() => p.kill('SIGKILL'), opts.timeoutMs) : null;
    p.on('error', reject);
    p.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string | null;
  pixFmt: string | null;
  audioCodec: string | null;
  audioSampleRate: number | null;
  bitRate: number | null;
  frameCount: number | null;
  formatName: string;
}

function parseRate(r: string | undefined): number {
  if (!r) return 0;
  const [a, b] = r.split('/').map(Number);
  return b ? a / b : a;
}

export async function probe(file: string): Promise<ProbeResult> {
  const r = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeoutMs: 30_000 });
  if (r.code !== 0) throw new Error(`ffprobe failed: ${r.stderr.trim().slice(0, 400)}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  const a = j.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
  return {
    durationSec: Number(j.format.duration ?? v?.duration ?? 0),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    fps: parseRate(v?.avg_frame_rate) || parseRate(v?.r_frame_rate),
    videoCodec: v?.codec_name ?? null,
    pixFmt: v?.pix_fmt ?? null,
    audioCodec: a?.codec_name ?? null,
    audioSampleRate: a ? Number(a.sample_rate) : null,
    bitRate: j.format.bit_rate ? Number(j.format.bit_rate) : null,
    frameCount: v?.nb_frames ? Number(v.nb_frames) : null,
    formatName: j.format.format_name,
  };
}

/** Black segments longer than minSec (pixel threshold on 0..1 luma). */
export async function detectBlack(file: string, minSec = 0.4): Promise<Array<{ start: number; end: number }>> {
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', `blackdetect=d=${minSec}:pix_th=0.08`, '-an', '-f', 'null', '-']);
  const out: Array<{ start: number; end: number }> = [];
  for (const m of r.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) out.push({ start: Number(m[1]), end: Number(m[2]) });
  return out;
}

/** Integrated loudness (LUFS) and true peak via EBU R128. */
export async function measureLoudness(file: string): Promise<{ integrated: number | null; truePeak: number | null }> {
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-']);
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i = /I:\s+(-?[\d.]+) LUFS/.exec(summary);
  const p = /Peak:\s+(-?[\d.]+) dBFS/.exec(summary);
  return { integrated: i ? Number(i[1]) : null, truePeak: p ? Number(p[1]) : null };
}

/** Count hard visual cuts (scene score above threshold). */
export async function countCuts(file: string, threshold = 0.35): Promise<number[]> {
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', `select='gt(scene,${threshold})',showinfo`, '-an', '-f', 'null', '-']);
  return [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/**
 * Two-pass EBU R128 loudness normalisation of the audio track; video is
 * stream-copied (no re-encode).
 */
export async function normalizeLoudness(input: string, output: string, targetLufs: number, truePeak: number, durationSec?: number): Promise<void> {
  const first = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', input, '-af', `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=11:print_format=json`, '-vn', '-f', 'null', '-']);
  const jsonText = first.stderr.slice(first.stderr.lastIndexOf('{'), first.stderr.lastIndexOf('}') + 1);
  const m = JSON.parse(jsonText);
  const filter = `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  // -t pins the container to the video duration (AAC re-encoding otherwise pads the tail).
  const limit = durationSec ? ['-t', durationSec.toFixed(3)] : [];
  const r = await run('ffmpeg', ['-hide_banner', '-y', '-i', input, ...limit, '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', output]);
  if (r.code !== 0) throw new Error(`loudnorm failed: ${r.stderr.slice(-400)}`);
}

export async function extractFrame(input: string, timeSec: number, output: string, width?: number): Promise<void> {
  const args = ['-hide_banner', '-y', '-ss', timeSec.toFixed(3), '-i', input, '-frames:v', '1'];
  if (width) args.push('-vf', `scale=${width}:-2`);
  args.push(output);
  const r = await run('ffmpeg', args);
  if (r.code !== 0) throw new Error(`frame extraction failed: ${r.stderr.slice(-300)}`);
}

/** One frame per timestamp, tiled into a single review image. */
export async function contactSheet(input: string, times: number[], output: string, tileWidth = 270): Promise<void> {
  const inputs = times.flatMap((t) => ['-ss', t.toFixed(3), '-i', input]);
  const scaled = times.map((_, i) => `[${i}:v]scale=${tileWidth}:-2,setsar=1[v${i}]`).join(';');
  const stack = `${times.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${times.length}[out]`;
  const r = await run('ffmpeg', ['-hide_banner', '-y', ...inputs, '-filter_complex', `${scaled};${stack}`, '-map', '[out]', '-frames:v', '1', output]);
  if (r.code !== 0) throw new Error(`contact sheet failed: ${r.stderr.slice(-300)}`);
}
