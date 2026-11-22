/**
 * Brand identities. Every visual token used by compositions, covers and the
 * dashboard comes from here so the two brands stay consistent everywhere.
 */
export const BRAND_IDS = ['tiresias', 'antitiresias'] as const;
export type BrandId = (typeof BRAND_IDS)[number];

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

export interface BrandTheme {
  id: BrandId;
  name: string;
  wordmark: string;
  tagline: string;
  seriesTitle: string;
  colors: {
    bg: string;
    bgElevated: string;
    ink: string;
    inkMuted: string;
    accent: string;
    accentInk: string;
    danger: string;
    hairline: string;
  };
  /** One distinct, high-contrast colour per passing option. */
  optionColors: Record<OptionLabel, string>;
  fonts: {
    display: string;
    displayWeight: number;
    body: string;
    mono: string;
  };
  copy: {
    decisionPrompt: string;
    revealPrefix: string;
    engagementPrimary: string;
    engagementSecondary: string;
    explanationEyebrow: string;
  };
}

export const THEMES: Record<BrandId, BrandTheme> = {
  tiresias: {
    id: 'tiresias',
    name: 'Tiresias',
    wordmark: 'TIRESIAS',
    tagline: 'SEE WHAT THE BOX SCORE CAN’T.',
    seriesTitle: 'COURT VISION',
    colors: {
      bg: '#05070A',
      bgElevated: '#0C1117',
      ink: '#F3F1EC',
      inkMuted: '#8A94A3',
      accent: '#5BE7C4',
      accentInk: '#03130E',
      danger: '#FF5D5D',
      hairline: 'rgba(243,241,236,0.14)',
    },
    optionColors: { A: '#4CC9F0', B: '#FFB547', C: '#F15BB5', D: '#A3E635' },
    fonts: {
      display: 'Inter Tight',
      displayWeight: 800,
      body: 'Inter Tight',
      mono: 'JetBrains Mono',
    },
    copy: {
      decisionPrompt: 'WHAT’S THE READ?',
      revealPrefix: 'ACTUAL READ',
      engagementPrimary: 'DID YOU SEE IT?',
      engagementSecondary: 'COMMENT YOUR PICK.',
      explanationEyebrow: 'THE READ',
    },
  },
  antitiresias: {
    id: 'antitiresias',
    name: 'AntiTiresias',
    wordmark: 'ANTI TIRESIAS',
    tagline: 'SEE ABSOLUTELY NOTHING.',
    seriesTitle: 'NEGATIVE COURT VISION',
    colors: {
      bg: '#0B0704',
      bgElevated: '#1A0F07',
      ink: '#FFF6E5',
      inkMuted: '#C9A988',
      accent: '#FFD400',
      accentInk: '#140C00',
      danger: '#FF3B1F',
      hairline: 'rgba(255,212,0,0.22)',
    },
    optionColors: { A: '#38BDF8', B: '#4ADE80', C: '#FF3B1F', D: '#E879F9' },
    fonts: {
      display: 'Anton',
      displayWeight: 400,
      body: 'Inter Tight',
      mono: 'JetBrains Mono',
    },
    copy: {
      decisionPrompt: 'THREE OPTIONS. ONE DISASTER.',
      revealPrefix: 'WHAT HE ACTUALLY DID',
      engagementPrimary: 'WOULD YOU HAVE DONE WORSE?',
      engagementSecondary: 'COMMENT YOUR PICK.',
      explanationEyebrow: 'THE FILM ROOM',
    },
  },
};

export function getTheme(brand: BrandId): BrandTheme {
  return THEMES[brand];
}
