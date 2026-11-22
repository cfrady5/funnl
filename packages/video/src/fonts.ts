import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

type Face = { family: string; file: string; weight: string; style?: string };
const FACES: Face[] = [
  ...['500', '700', '800', '900'].map((w) => ({ family: 'Inter Tight', file: `inter-tight-%s-${w}-normal.woff2`, weight: w })),
  ...['800', '900'].map((w) => ({ family: 'Inter Tight', file: `inter-tight-%s-${w}-italic.woff2`, weight: w, style: 'italic' })),
  { family: 'Anton', file: 'anton-%s-400-normal.woff2', weight: '400' },
  ...['500', '700', '800'].map((w) => ({ family: 'JetBrains Mono', file: `jetbrains-mono-%s-${w}-normal.woff2`, weight: w })),
];

let loading: Promise<void> | null = null;

/**
 * Loads every bundled OFL font (latin + latin-ext so names like Jokić and
 * Dončić render correctly). Safe to call many times; delayRender is handled
 * inside @remotion/fonts so frames never render with fallback fonts.
 */
export function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!loading) {
    loading = Promise.all(
      FACES.flatMap((f) =>
        (['latin', 'latin-ext'] as const).map((subset) =>
          loadFont({
            family: f.family,
            url: staticFile(`fonts/${f.file.replace('%s', subset)}`),
            weight: f.weight,
            style: f.style ?? 'normal',
            unicodeRange: subset === 'latin' ? LATIN : LATIN_EXT,
            display: 'block',
          }),
        ),
      ),
    ).then(() => undefined);
  }
  return loading;
}
