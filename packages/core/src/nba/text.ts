/** Game clock in any provider format → seconds remaining in the period. */
export function clockToSeconds(clock: string | null | undefined): number | null {
  if (clock == null) return null;
  const c = clock.trim();
  if (!c) return null;
  // ISO 8601 duration used by the official feed: PT04M59.00S
  const iso = /^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(c);
  if (iso) return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
  // M:SS or MM:SS(.t)
  const ms = /^(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(c);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  // Seconds only, e.g. "53.4"
  if (/^\d+(\.\d+)?$/.test(c)) return Number(c);
  return null;
}

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/** Lowercase, strip diacritics/punctuation and generational suffixes. "Luka Dončić Jr." → "luka doncic". */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t))
    .join(' ');
}

export interface NamedPlayer {
  id: string;
  firstName: string;
  lastName: string;
  teamId?: string | null;
}

/**
 * Resolve a name as written in play text ("Jalen Brunson", "J. Brunson",
 * "Brunson") to a roster player. Returns null when absent or ambiguous —
 * never guesses between two candidates.
 */
export function resolvePlayerName(written: string, roster: NamedPlayer[], teamId?: string | null): NamedPlayer | null {
  const w = normalizeName(written);
  if (!w) return null;
  const pool = teamId ? roster.filter((p) => !p.teamId || p.teamId === teamId) : roster;
  const full = (p: NamedPlayer) => normalizeName(`${p.firstName} ${p.lastName}`);
  const exact = pool.filter((p) => full(p) === w);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const tokens = w.split(' ');
  // "j brunson" — initial + last name
  if (tokens.length >= 2 && tokens[0].length === 1) {
    const last = tokens.slice(1).join(' ');
    const m = pool.filter((p) => normalizeName(p.lastName) === last && normalizeName(p.firstName).startsWith(tokens[0]));
    if (m.length === 1) return m[0];
    return null;
  }
  // last name only
  if (tokens.length === 1) {
    const m = pool.filter((p) => normalizeName(p.lastName) === w);
    return m.length === 1 ? m[0] : null;
  }
  // full names that differ by a middle token, e.g. "Shai Gilgeous Alexander" vs roster spelling
  const m = pool.filter((p) => full(p).replace(/\s/g, '') === w.replace(/\s/g, ''));
  return m.length === 1 ? m[0] : null;
}
