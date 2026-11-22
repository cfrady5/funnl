import { getTheme, type BrandId } from '@tiresias/core';
import React from 'react';

/** The sightline eye. AntiTiresias uses the same eye, crossed out. */
export const EyeGlyph: React.FC<{ brand: BrandId; size: number; color?: string; strokeWidth?: number; pupil?: number }> = ({
  brand,
  size,
  color,
  strokeWidth = 7,
  pupil = 1,
}) => {
  const theme = getTheme(brand);
  const c = color ?? theme.colors.accent;
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" style={{ display: 'block', overflow: 'visible' }}>
      <path d="M4 31 C 22 4, 78 4, 96 31 C 78 58, 22 58, 4 31 Z" fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <circle cx="50" cy="31" r={12 * pupil} fill={c} />
      {brand === 'antitiresias' ? (
        <>
          <line x1="14" y1="58" x2="86" y2="4" stroke={theme.colors.bg} strokeWidth={strokeWidth + 8} strokeLinecap="round" />
          <line x1="14" y1="58" x2="86" y2="4" stroke={theme.colors.danger} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
};

export const Wordmark: React.FC<{ brand: BrandId; size: number; color?: string; letterSpacing?: number }> = ({ brand, size, color, letterSpacing }) => {
  const theme = getTheme(brand);
  return (
    <span
      style={{
        fontFamily: theme.fonts.display,
        fontWeight: theme.fonts.displayWeight,
        fontSize: size,
        letterSpacing: letterSpacing ?? (brand === 'tiresias' ? size * 0.32 : size * 0.04),
        color: color ?? theme.colors.ink,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {theme.wordmark}
    </span>
  );
};

/** Diagonal hazard stripes for AntiTiresias framing. */
export const HazardStripes: React.FC<{ width: number; height: number; offset?: number; colorA?: string; colorB?: string }> = ({
  width,
  height,
  offset = 0,
  colorA = '#FFD400',
  colorB = '#0B0704',
}) => (
  <div
    style={{
      width,
      height,
      backgroundImage: `repeating-linear-gradient(-45deg, ${colorA} 0 18px, ${colorB} 18px 36px)`,
      backgroundPosition: `${offset}px 0`,
      backgroundSize: '51px 51px',
    }}
  />
);
