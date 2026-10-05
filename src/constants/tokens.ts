import type { TextStyle } from 'react-native';

export type Theme = 'dark' | 'light';

// Neutral, low-chroma surfaces; the green accent is reserved for CTA / LIVE / donation.
export const Colors = {
  dark: {
    canvas: '#101010',
    canvasSoft: '#1c1c1e',
    canvasSoft2: '#2c2c2e',
    hairline: '#2a2a2c',
    ink: '#f2f2f2',
    inkStrong: '#ffffff',
    body: '#c9cdd2',
    mute: '#9ea4ab',
    primary: '#00d992',
    primarySoft: '#2fd6a1',
    primaryDeep: '#10b981',
    primaryTint: 'rgba(0, 217, 146, 0.10)',
    onPrimary: '#101010',
    danger: '#f0625a',
    favorite: '#ffc94d',
    scrim: 'rgba(0, 0, 0, 0.55)',
  },
  light: {
    canvas: '#ffffff',
    canvasSoft: '#f2f4f6',
    canvasSoft2: '#e5e8eb',
    hairline: '#eceef1',
    ink: '#191f28',
    inkStrong: '#000000',
    body: '#4e5968',
    mute: '#6b7684',
    primary: '#10b981',
    primarySoft: '#0a8f61',
    primaryDeep: '#0a8f61',
    primaryTint: 'rgba(16, 185, 129, 0.10)',
    onPrimary: '#ffffff',
    danger: '#e5383b',
    favorite: '#f5a700',
    scrim: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.dark;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
  xxxxxxl: 64,
} as const;

export const Radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

/** Minimum touch target (dp) for any tappable control. */
export const TOUCH = 44;

// One system sans scale for every label, count and button — no monospace in the UI.
// Smallest readable text is 12; anything that carries meaning should be 13+.
export const Type = {
  hero: { fontSize: 26, lineHeight: 35, fontWeight: 700, letterSpacing: -0.6 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: 700, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: 700, letterSpacing: -0.3 },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: 600, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
  badge: { fontSize: 11, lineHeight: 14, fontWeight: 700 },
} as const satisfies Record<string, TextStyle>;
