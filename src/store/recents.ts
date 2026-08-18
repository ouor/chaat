import { kv } from '@/storage/kv';

const KEY = 'recent-searches';
const MAX = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = kv.getString(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(q: string): string[] {
  const list = getRecentSearches().filter((x) => x !== q);
  const next = [q, ...list].slice(0, MAX);
  kv.setString(KEY, JSON.stringify(next));
  return next;
}
