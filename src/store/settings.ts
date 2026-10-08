import { useSyncExternalStore } from 'react';

import { kv } from '@/storage/kv';

export type ThemeMode = 'dark' | 'light';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type RetentionDays = 7 | 30 | 90 | 0;
export type ChatVariant = 'compact' | 'card';

export interface Settings {
  theme: ThemeMode;
  fontScale: FontScale;
  retentionDays: RetentionDays;
  chatVariant: ChatVariant;
  /** Keep the open chat room receiving (and saving) after the app is left, with a notification. */
  backgroundCollect: boolean;
}

const DEFAULTS: Settings = {
  theme: 'dark',
  fontScale: 'md',
  retentionDays: 30,
  chatVariant: 'card',
  backgroundCollect: true,
};
const KEY = 'settings';
// v2: two-line rows became the default. Older saves always wrote chatVariant (every update
// persisted the whole object), so a stored 'compact' wasn't necessarily a choice; drop it once.
const VERSION = 2;

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cache) return cache;
  try {
    const raw = kv.getString(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Settings> & { v?: number }) : {};
    if (saved.v !== VERSION) delete saved.chatVariant;
    delete saved.v;
    cache = { ...DEFAULTS, ...saved };
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
  kv.setString(KEY, JSON.stringify({ ...read(), ...patch, v: VERSION }));
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
