import { useEffect, useSyncExternalStore } from 'react';

import { getEmojiPacks } from '@/client/chzzk/rest';

// Emoji packs barely change, but every chat / saved-chat screen used to refetch them. Keep one
// map per channel for the app session; image bytes are cached separately by expo-image.
const TTL_MS = 30 * 60 * 1000;
const EMPTY: Record<string, string> = {};
const cache = new Map<string, { map: Record<string, string>; at: number }>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

function fresh(key: string): boolean {
  const hit = cache.get(key);
  return !!hit && Date.now() - hit.at < TTL_MS;
}

function load(key: string, channelId: string, cookie?: string): void {
  if (fresh(key) || loading.has(key)) return;
  loading.add(key);
  getEmojiPacks(channelId, cookie)
    .then((emojis) => {
      const map: Record<string, string> = {};
      for (const e of emojis) map[e.emojiId] = e.imageUrl;
      cache.set(key, { map, at: Date.now() });
      for (const l of listeners) l();
    })
    .catch(() => undefined)
    .finally(() => loading.delete(key));
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Channel emoji id -> image URL (CHZZK base packs plus the channel's own), empty until loaded. */
export function useEmojiMap(channelId: string, cookie?: string): Record<string, string> {
  // Subscription packs depend on the viewer, so signed-in and signed-out maps are kept apart.
  const key = `${channelId}:${cookie ? 'auth' : 'anon'}`;

  useEffect(() => {
    load(key, channelId, cookie);
  }, [key, channelId, cookie]);

  // A stale map is still served while a refresh is in flight (snapshots must not flip on a timer).
  return useSyncExternalStore(subscribe, () => cache.get(key)?.map ?? EMPTY);
}
