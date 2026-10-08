import { useSyncExternalStore } from 'react';

import { isChannelId } from '@/client/chzzk/rest';
import { kv } from '@/storage/kv';

const KEY = 'favorites';

export interface FavoriteChannel {
  channelId: string;
  channelName: string;
  channelImageUrl: string;
  addedAt: number;
}

// One cached snapshot shared by every screen: a per-hook useState copy went stale on the
// home screen (it stays mounted under the stack) after toggling a favorite elsewhere.
let cache: FavoriteChannel[] | null = null;
const listeners = new Set<() => void>();

// Stored JSON is untrusted (older app versions, API nulls such as a missing channel image):
// keep every entry that has a channel id and fill the rest, so no favorite is silently dropped.
function toFavorite(v: unknown): FavoriteChannel[] {
  if (typeof v !== 'object' || v === null) return [];
  const f = v as Record<string, unknown>;
  if (typeof f.channelId !== 'string' || !f.channelId) return [];
  return [
    {
      channelId: f.channelId,
      channelName: typeof f.channelName === 'string' ? f.channelName : f.channelId,
      channelImageUrl: typeof f.channelImageUrl === 'string' ? f.channelImageUrl : '',
      addedAt: typeof f.addedAt === 'number' ? f.addedAt : 0,
    },
  ];
}

function read(): FavoriteChannel[] {
  if (cache) return cache;
  try {
    const raw = kv.getString(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.flatMap(toFavorite) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: FavoriteChannel[]): void {
  kv.setString(KEY, JSON.stringify(list));
  cache = null;
  for (const l of listeners) l();
}

export function isFavorite(channelId: string): boolean {
  return read().some((f) => f.channelId === channelId);
}

export function toggleFavorite(
  f: { channelId: string; channelName: string; channelImageUrl: string },
): boolean {
  // The id may come from a deep link; never persist something that isn't a channel id.
  if (!isChannelId(f.channelId)) return false;
  const list = read();
  const existing = list.find((x) => x.channelId === f.channelId);
  if (existing) {
    write(list.filter((x) => x.channelId !== f.channelId));
    return false;
  }
  write([{ ...f, addedAt: Date.now() }, ...list]);
  return true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFavorites(): FavoriteChannel[] {
  return useSyncExternalStore(subscribe, read);
}
