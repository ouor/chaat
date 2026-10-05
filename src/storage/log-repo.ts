import { AppState, type NativeEventSubscription } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';

import { getDb } from './db';

interface PendingLog {
  channelId: string;
  m: ChatMessage;
}

const buffer: PendingLog[] = [];
const FLUSH_MS = 1000;
// ponytail: if the DB keeps failing, failed batches are re-queued up to this many rows and the
// oldest are dropped past it, so a dead DB can't grow memory until the app is killed (losing all).
// Upgrade path: spill to a file if a persistently failing DB ever shows up in practice.
const MAX_BUFFER = 20000;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let flushing: Promise<void> | null = null;

function startTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    void flush();
  }, FLUSH_MS);
  // Backgrounded apps get killed without warning; persist the buffer while we still can.
  appStateSub ??= AppState.addEventListener('change', (s) => {
    if (s !== 'active') void flushNow();
  });
}

export function enqueueLog(channelId: string, m: ChatMessage): void {
  buffer.push({ channelId, m });
  startTimer();
}

export function stopLogging(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  appStateSub?.remove();
  appStateSub = null;
}

// Single flusher: a slow write must not overlap the next tick's transaction on the same connection.
function flush(): Promise<void> {
  flushing ??= writeBuffered().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function writeBuffered(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const db = await getDb();
    // ponytail: withTransactionAsync instead of withExclusiveTransactionAsync so the write path
    // also works on web (where the exclusive variant throws). Single flusher, so exclusivity adds
    // nothing here. Upgrade back if a second writer appears.
    await db.withTransactionAsync(async () => {
      const stmt = await db.prepareAsync(
        'INSERT OR IGNORE INTO messages (channel_id, chat_channel_id, user_id_hash, nickname, message, type, msg_time, extras_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      try {
        for (const { channelId, m } of batch) {
          await stmt.executeAsync([
            channelId,
            m.chatChannelId,
            m.userIdHash,
            m.nickname,
            m.message,
            m.msgType,
            m.msgTime,
            JSON.stringify(m.extras),
            Date.now(),
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    });
  } catch (e) {
    console.log('[log] flush FAILED', e);
    buffer.unshift(...batch);
    if (buffer.length > MAX_BUFFER) {
      const dropped = buffer.splice(0, buffer.length - MAX_BUFFER).length;
      console.warn(`[log] buffer over ${MAX_BUFFER}, dropped ${dropped} oldest`);
    }
  }
}

export async function flushNow(): Promise<void> {
  if (flushing) await flushing;
  await flush();
}

export interface LogRow {
  nickname: string;
  message: string;
  type: string;
  msg_time: number;
}

// ponytail: the viewer shows only the newest LOG_LIMIT matching rows; older ones are reachable
// by narrowing the search. Upgrade path: keyset pagination on msg_time when scrolling up.
export const LOG_LIMIT = 2000;

/** Newest LOG_LIMIT rows (oldest first), optionally filtered by a message/nickname substring. */
export async function getLogs(channelId: string, query = ''): Promise<LogRow[]> {
  const db = await getDb();
  const q = query.trim().toLowerCase();
  const rows = q
    ? await db.getAllAsync<LogRow>(
        `SELECT nickname, message, type, msg_time FROM messages
         WHERE channel_id = ? AND (instr(lower(message), ?) > 0 OR instr(lower(nickname), ?) > 0)
         ORDER BY msg_time DESC LIMIT ?`,
        channelId,
        q,
        q,
        LOG_LIMIT,
      )
    : await db.getAllAsync<LogRow>(
        'SELECT nickname, message, type, msg_time FROM messages WHERE channel_id = ? ORDER BY msg_time DESC LIMIT ?',
        channelId,
        LOG_LIMIT,
      );
  return rows.reverse();
}

export async function countLogs(channelId?: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    channelId ? 'SELECT COUNT(*) AS c FROM messages WHERE channel_id = ?' : 'SELECT COUNT(*) AS c FROM messages',
    ...(channelId ? [channelId] : []),
  );
  return row?.c ?? 0;
}

export async function clearLogs(channelId?: string): Promise<void> {
  const db = await getDb();
  if (channelId) {
    await db.runAsync('DELETE FROM messages WHERE channel_id = ?', channelId);
  } else {
    await db.runAsync('DELETE FROM messages');
  }
}

export async function pruneLogs(days: number): Promise<void> {
  if (!days) return;
  const db = await getDb();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  await db.runAsync('DELETE FROM messages WHERE msg_time < ?', cutoff);
}
