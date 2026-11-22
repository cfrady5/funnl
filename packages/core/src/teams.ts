/**
 * Primary team colours used for the cover colour block. Colours only — team
 * logos and wordmarks are trademarks and are never rendered without a licence.
 */
export const TEAM_PRIMARY: Record<string, string> = {
  ATL: '#C8102E', BOS: '#007A33', BKN: '#111111', CHA: '#1D1160', CHI: '#CE1141',
  CLE: '#860038', DAL: '#00538C', DEN: '#0E2240', DET: '#C8102E', GSW: '#1D428A',
  HOU: '#CE1141', IND: '#002D62', LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9',
  MIA: '#98002E', MIL: '#00471B', MIN: '#0C2340', NOP: '#0C2340', NYK: '#006BB6',
  OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#1D1160', POR: '#C8102E',
  SAC: '#5A2D81', SAS: '#111111', TOR: '#CE1141', UTA: '#002B5C', WAS: '#002B5C',
};

export function teamBlockColor(abbr: string | null | undefined): string | null {
  return abbr ? TEAM_PRIMARY[abbr.toUpperCase()] ?? null : null;
}
