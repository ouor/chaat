import { useSyncExternalStore } from 'react';

import { kv } from '@/storage/kv';

export type ThemeMode = 'dark' | 'light';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type RetentionDays = 7 | 30 | 90 | 0;

export interface Settings {
  theme: ThemeMode;
  fontScale: FontScale;
  retentionDays: RetentionDays;
  autoscroll: boolean;
}

const DEFAULTS: Settings = { theme: 'dark', fontScale: 'md', retentionDays: 30, autoscroll: true };
const KEY = 'settings';

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cache) return cache;
  try {
    const raw = kv.getString(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function emit(): void {
  cache = null;
  for (const l of listeners) l();
}

export function getSettings(): Settings {
  return read();
}

export function updateSettings(patch: Partial<Settings>): void {
  kv.setString(KEY, JSON.stringify({ ...read(), ...patch }));
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read);
}
