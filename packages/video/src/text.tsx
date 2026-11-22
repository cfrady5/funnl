import { fitTextOnNLines } from '@remotion/layout-utils';
import React, { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { ensureFonts } from './fonts';

/** Blocks rendering until bundled fonts are ready, so measurement is exact. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading brand fonts'));
  useEffect(() => {
    let alive = true;
    ensureFonts()
      .then(() => {
        if (alive) setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
    return () => {
      alive = false;
    };
  }, [handle]);
  return ready;
}

export interface FitTextProps {
  text: string;
  width: number;
  maxLines: number;
  maxFontSize: number;
  minFontSize?: number;
  fontFamily: string;
  fontWeight: number;
  letterSpacingEm?: number;
  lineHeight?: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
  fontStyle?: 'normal' | 'italic';
  uppercase?: boolean;
}

/**
 * Text laid out on at most `maxLines` lines at the largest size that fits
 * `width`. Lines are measured with the real font, never left to the browser.
 */
export const FitText: React.FC<FitTextProps> = ({
  text,
  width,
  maxLines,
  maxFontSize,
  minFontSize = 18,
  fontFamily,
  fontWeight,
  letterSpacingEm = 0,
  lineHeight = 1.04,
  color,
  align = 'left',
  style,
  fontStyle = 'normal',
  uppercase = true,
}) => {
  const value = uppercase ? text.toUpperCase() : text;
  let fontSize = maxFontSize;
  let lines = [value];
  try {
    const r = fitTextOnNLines({
      text: value,
      maxLines,
      maxBoxWidth: width,
      fontFamily,
      fontWeight,
      maxFontSize,
      letterSpacing: `${letterSpacingEm}em`,
      additionalStyles: { 'font-style': fontStyle },
    });
    fontSize = Math.max(minFontSize, Math.floor(r.fontSize));
    lines = r.lines;
  } catch {
    // measurement unavailable (e.g. during SSR); fall back to CSS wrapping
  }
  return (
    <div
      style={{
        width,
        fontFamily,
        fontWeight,
        fontStyle,
        fontSize,
        lineHeight,
        letterSpacing: `${letterSpacingEm}em`,
        color,
        textAlign: align,
        ...style,
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap' }}>
          {l}
        </div>
      ))}
    </div>
  );
};
