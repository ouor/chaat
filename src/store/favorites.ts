import { useCallback, useState } from 'react';

import { kv } from '@/storage/kv';

const KEY = 'favorites';

export interface FavoriteChannel {
  channelId: string;
  channelName: string;
  channelImageUrl: string;
  addedAt: number;
}

function read(): FavoriteChannel[] {
  try {
    const raw = kv.getString(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FavoriteChannel[]) : [];
  } catch {
    return [];
  }
}

function write(list: FavoriteChannel[]): void {
  kv.setString(KEY, JSON.stringify(list));
}

export function isFavorite(channelId: string): boolean {
  return read().some((f) => f.channelId === channelId);
}

export function toggleFavorite(
  f: { channelId: string; channelName: string; channelImageUrl: string },
): boolean {
  const list = read();
  const existing = list.find((x) => x.channelId === f.channelId);
  if (existing) {
    write(list.filter((x) => x.channelId !== f.channelId));
    return false;
  }
  write([{ ...f, addedAt: Date.now() }, ...list]);
  return true;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteChannel[]>(read);

  const refresh = useCallback(() => setFavorites(read()), []);

  return { favorites, refresh };
}
