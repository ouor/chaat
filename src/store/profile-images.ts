import { useCallback, useSyncExternalStore } from 'react';

import { getProfileCard } from '@/client/chzzk/rest';
import { kv } from '@/storage/kv';

// Chat WS profiles omit profileImageUrl, so avatars are backfilled from profile-card. A busy
// stream has thousands of chatters, so this is bounded on every axis:
// - only rows the user can see are requested (the screen passes viewable rows);
// - a small LIFO queue (newest visible first) that drops what scrolled away, few requests in
//   flight, and a minimum gap between request starts;
// - requests carry no cookie: profile-card is public, and the user's session must not be
//   attached to a request stream this size;
// - results (including "no image") persist in an LRU, so returning chatters cost nothing; the
//   image bytes themselves are cached by expo-image (memory-disk).
const KEY = 'profile-images';
const MAX_ENTRIES = 3000;
const TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_QUEUE = 40;
const CONCURRENCY = 3;
const MIN_GAP_MS = 250;
const SAVE_DELAY_MS = 5000;

interface Entry {
  url: string | null;
  at: number;
}

let cache: Map<string, Entry> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<string, Set<() => void>>();
const queue: { cid: string; id: string }[] = [];
const inFlight = new Set<string>();
let nextStartAt = 0;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;

function entries(): Map<string, Entry> {
  if (cache) return cache;
  cache = new Map();
  try {
    const raw = kv.getString(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
        const [id, url, at] = item as [string, unknown, unknown];
        if (typeof at === 'number' && (url === null || typeof url === 'string')) cache.set(id, { url, at });
      }
    }
  } catch {
    // corrupt cache: start empty
  }
  return cache;
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    kv.setString(KEY, JSON.stringify([...entries()].map(([id, e]) => [id, e.url, e.at])));
  }, SAVE_DELAY_MS);
}

function fresh(e: Entry | undefined): boolean {
  if (!e) return false;
  return Date.now() - e.at < (e.url ? TTL_MS : MISS_TTL_MS);
}

function store(id: string, url: string | null): void {
  const m = entries();
  m.delete(id);
  m.set(id, { url, at: Date.now() });
  // Map keeps insertion order, so the first keys are the least recently stored.
  while (m.size > MAX_ENTRIES) m.delete(m.keys().next().value as string);
  scheduleSave();
  for (const l of listeners.get(id) ?? []) l();
}

function pump(): void {
  pumpTimer = null;
  while (inFlight.size < CONCURRENCY && queue.length > 0) {
    const wait = nextStartAt - Date.now();
    if (wait > 0) {
      pumpTimer = setTimeout(pump, wait);
      return;
    }
    const { cid, id } = queue.pop() as { cid: string; id: string };
    if (fresh(entries().get(id)) || inFlight.has(id)) continue;
    inFlight.add(id);
    nextStartAt = Date.now() + MIN_GAP_MS;
    getProfileCard(cid, id)
      .then((pc) => store(id, pc.profileImageUrl))
      // Failures are remembered like misses (short TTL) so a flaky API isn't hammered.
      .catch(() => store(id, null))
      .finally(() => {
        inFlight.delete(id);
        if (!pumpTimer) pump();
      });
  }
}

/** Queue avatar lookups for users currently on screen (newest call wins priority). */
export function requestProfileImages(chatChannelId: string, userIdHashes: string[]): void {
  const m = entries();
  for (const id of userIdHashes) {
    if (!id || fresh(m.get(id)) || inFlight.has(id)) continue;
    const i = queue.findIndex((q) => q.id === id);
    if (i >= 0) queue.splice(i, 1);
    queue.push({ cid: chatChannelId, id });
  }
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  if (!pumpTimer) pump();
}

/** Backfilled avatar URL for one user; re-renders only when that user's entry changes. */
export function useProfileImage(userIdHash: string): string | undefined {
  const subscribe = useCallback(
    (l: () => void) => {
      let set = listeners.get(userIdHash);
      if (!set) listeners.set(userIdHash, (set = new Set()));
      set.add(l);
      return () => {
        set.delete(l);
        if (set.size === 0) listeners.delete(userIdHash);
      };
    },
    [userIdHash],
  );
  return useSyncExternalStore(subscribe, () => entries().get(userIdHash)?.url ?? undefined);
}
