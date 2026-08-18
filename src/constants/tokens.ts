import '@/global.css';

import { Platform } from 'react-native';

export type Theme = 'dark' | 'light';

export const Colors = {
  dark: {
    canvas: '#101010',
    canvasSoft: '#1a1a1a',
    canvasSoft2: '#232323',
    hairline: '#3d3a39',
    ink: '#f2f2f2',
    inkStrong: '#ffffff',
    body: '#bdbdbd',
    mute: '#8b949e',
    primary: '#00d992',
    primarySoft: '#2fd6a1',
    primaryDeep: '#10b981',
    onPrimary: '#101010',
    danger: '#e5534b',
    nick1: '#00d992',
    nick2: '#5fd0b4',
    nick3: '#a9b8b2',
    nick4: '#d8d3cc',
    nick5: '#8b949e',
    nick6: '#2fd6a1',
  },
  light: {
    canvas: '#ffffff',
    canvasSoft: '#f5f6f7',
    canvasSoft2: '#ebecee',
    hairline: '#e0ddda',
    ink: '#101010',
    inkStrong: '#000000',
    body: '#4b4b4b',
    mute: '#767c85',
    primary: '#10b981',
    primarySoft: '#0ea371',
    primaryDeep: '#0a8f61',
    onPrimary: '#ffffff',
    danger: '#d1362c',
    nick1: '#0a8f61',
    nick2: '#166e59',
    nick3: '#4b5a55',
    nick4: '#6a5f54',
    nick5: '#4f5b64',
    nick6: '#0d7f57',
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
  pill: 9999,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
});
