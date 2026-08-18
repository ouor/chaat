import { createMMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

const mmkv = createMMKV();

export const kv = {
  getString(key: string): string | null {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return mmkv.getString(key) ?? null;
  },
  setString(key: string, value: string): void {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    mmkv.set(key, value);
  },
  delete(key: string): void {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    mmkv.remove(key);
  },
};
