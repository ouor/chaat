import type { TextStyle } from 'react-native';

export type Theme = 'dark' | 'light';

// Neutral, low-chroma surfaces; the green accent is reserved for CTA / LIVE / donation.
// Named by role: canvas (screen) < surface (cards, fields, sheets) < surfaceRaised (fills on a
// surface: selected tab, secondary button, tag, sheet handle). accentText is the green for text
// and small marks (donor name, amount, live viewer count); primary is the filled green.
export const Colors = {
  dark: {
    canvas: '#101010',
    surface: '#1c1c1e',
    surfaceRaised: '#2c2c2e',
    hairline: '#2a2a2c',
    ink: '#f2f2f2',
    body: '#c9cdd2',
    mute: '#adb3b9',
    primary: '#00d992',
    accentText: '#2fd6a1',
    primaryTint: 'rgba(0, 217, 146, 0.10)',
    onPrimary: '#101010',
    danger: '#f0625a',
    scrim: 'rgba(0, 0, 0, 0.55)',
    // Per-user nickname hues. Never green/teal: that hue means CTA / LIVE / donation.
    nick1: '#7cc4ff',
    nick2: '#b9a2ff',
    nick3: '#ff9d8f',
    nick4: '#f2c46b',
    nick5: '#f59fd2',
    nick6: '#a9bde0',
    // App mark (same as the launcher icon): green slash on a black tile. A brand constant, not UI
    // accent, so it is identical in both themes; the dark tile is lifted one step off the canvas.
    brandTile: '#1c1c1e',
    brandMark: '#00d992',
  },
  light: {
    canvas: '#ffffff',
    surface: '#f2f4f6',
    surfaceRaised: '#e5e8eb',
    hairline: '#eceef1',
    ink: '#191f28',
    body: '#4e5968',
    mute: '#5d6875',
    primary: '#10b981',
    accentText: '#0a8f61',
    primaryTint: 'rgba(16, 185, 129, 0.10)',
    onPrimary: '#101010',
    danger: '#e5383b',
    scrim: 'rgba(0, 0, 0, 0.4)',
    nick1: '#1d6cb8',
    nick2: '#6a4fc4',
    nick3: '#c0412d',
    nick4: '#8f5d00',
    nick5: '#b0307a',
    nick6: '#46598a',
    brandTile: '#101010',
    brandMark: '#00d992',
  },
} as const;

export type ThemeColor = keyof typeof Colors.dark;

export const Spacing = {
  xxs: 2,
  xs: 4,
  /** Between inline items in one line (badge, nickname, time). */
  tight: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
} as const;

export const Radius = {
  xs: 4,
  md: 8,
  lg: 12,
  xl: 16,
  /** Bottom sheet top corners. */
  xxl: 24,
  pill: 9999,
} as const;

/** Minimum touch target (dp) for any tappable control. */
export const TOUCH = 44;

/** Fixed sizes of recurring elements, so every screen draws them the same. */
export const Size = {
  /** Compact header pill button ("지난 채팅", "내보내기"); its hit area is padded to TOUCH. */
  chip: 34,
  /** Status dot (live / connection). */
  dot: 6,
  /** Round clear (x) button inside a text field. */
  clear: 20,
  /** Time column of a chat line, live room and archive alike (fits "23:59"). */
  timeColumn: 38,
  /** Button heights besides TOUCH (md). */
  buttonSm: 36,
  buttonLg: 54,
  /** Grab bar at the top of a bottom sheet. */
  sheetHandle: { width: 36, height: 4 },
} as const;

export const IconSize = { xs: 12, sm: 16, md: 20, lg: 22, xl: 24 } as const;
export type IconSizeName = keyof typeof IconSize;

export const AvatarSize = { sm: 32, md: 48, lg: 52 } as const;
export type AvatarSizeName = keyof typeof AvatarSize;

/** Square/round tile behind an icon (feature lists, account, empty states). */
export const TileSize = { md: 40, lg: 48, xl: 56 } as const;

export const Opacity = {
  /** Feedback while a filled control is held down. */
  pressed: 0.8,
  /** De-emphasized content that is still usable (small search results). */
  dim: 0.6,
  /** A control that can't be used right now (text-only rows; filled buttons go gray instead). */
  disabled: 0.4,
} as const;

// One system sans scale for every label, count and button — no monospace in the UI.
// Smallest readable text is 12; anything that carries meaning should be 13+.
export const Type = {
  hero: { fontSize: 26, lineHeight: 35, fontWeight: 700, letterSpacing: -0.6 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: 700, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: 700, letterSpacing: -0.3 },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: 600, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  /** Secondary paragraph text (descriptions, hints). */
  labelRegular: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  /** Button labels, emphasized values. */
  labelStrong: { fontSize: 14, lineHeight: 20, fontWeight: 700 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
  microStrong: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
  badge: { fontSize: 11, lineHeight: 14, fontWeight: 700 },
  /** Latin all-caps badge ("LIVE"): tracked out so the letters don't run together. */
  badgeCaps: { fontSize: 11, lineHeight: 14, fontWeight: 700, letterSpacing: 0.5 },
  /** The "chaat" name next to the app mark. */
  wordmark: { fontSize: 17, lineHeight: 20, fontWeight: 700, letterSpacing: -0.4 },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

/** Chat text size per the "채팅 글자 크기" setting (live room, notification preview, settings picker). */
export const ChatFont = { sm: 14, md: 15, lg: 17, xl: 20 } as const;

/** Every text size a chat line uses, derived from its body size so the setting scales them together. */
export function chatType(size: number) {
  const lineHeight = size + 6;
  const small = { fontSize: size - 1, lineHeight };
  return {
    body: { fontSize: size, lineHeight },
    /** Secondary line text (subscription notice, "님의 후원"). */
    small: { ...small, fontWeight: 400 },
    nick: { ...small, fontWeight: 600 },
    donor: { ...small, fontWeight: 700 },
    lineHeight,
    emoji: size + 2,
    amount: { fontSize: size + 1, fontWeight: 800 },
    amountCard: { fontSize: size + 3, fontWeight: 800 },
  } as const;
}
