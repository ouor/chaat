import { Platform } from 'react-native';

// shortcut: Expo Go lacks the mmkv native module (Nitro). Lazy-require + in-memory
// fallback keeps the app runnable in Expo Go; real builds use MMKV. Upgrade path: none needed.
interface MmkvLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
}

let mmkv: MmkvLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require so Expo Go without mmkv native doesn't crash at import
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  mmkv = createMMKV();
} catch {
  mmkv = null;
}

const mem = new Map<string, string>();

export const kv = {
  getString(key: string): string | null {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    if (mmkv) return mmkv.getString(key) ?? null;
    return mem.get(key) ?? null;
  },
  setString(key: string, value: string): void {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    if (mmkv) {
      mmkv.set(key, value);
      return;
    }
    mem.set(key, value);
  },
  delete(key: string): void {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    if (mmkv) {
      mmkv.remove(key);
      return;
    }
    mem.delete(key);
  },
};
